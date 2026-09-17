import * as SQLite from "expo-sqlite";

import {
  clearConversionPending,
  escapeSqlLiteral,
  getDatabaseEncryptionKey,
  isConversionPending,
  markConversionPending,
} from "@/database/encryption";
import { SCHEMA_STATEMENTS, DATABASE_NAME } from "@/database/schema";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Cópia cifrada intermediária, usada só durante a conversão. */
const ENCRYPTED_EXPORT_NAME = `${DATABASE_NAME}.encrypted`;

/**
 * A posição na lista é a chave da migração: `user_version` guarda quantos
 * statements já foram aplicados, e só o que vier depois roda. Por isso
 * `SCHEMA_STATEMENTS` é append-only — remover ou reordenar um statement
 * dessincroniza o contador de todo aparelho instalado.
 *
 * Antes daqui a lista inteira era reexecutada a cada abertura. Isso custava 16
 * execuções (7 delas lançando "duplicate column name" só para serem engolidas)
 * e, pior, transformava um `UPDATE` de migração em regra permanente, que
 * remarcava a sincronização com o Google a cada boot.
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
  const applied = row?.user_version ?? 0;

  if (applied >= SCHEMA_STATEMENTS.length) {
    return;
  }

  for (let index = applied; index < SCHEMA_STATEMENTS.length; index += 1) {
    try {
      await db.execAsync(SCHEMA_STATEMENTS[index]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("duplicate column name")) {
        throw error;
      }
    }
  }

  // `PRAGMA` não aceita parâmetro; o valor é o tamanho da nossa própria lista,
  // nunca entrada externa.
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_STATEMENTS.length}`);
}

/**
 * Lê o catálogo do banco. `SELECT 1` não servia como verificação: ele não toca
 * no arquivo e passa mesmo quando a chave está errada — era o que fazia o
 * código concluir "texto puro" numa instalação nova.
 */
async function canReadSchema(db: SQLite.SQLiteDatabase): Promise<boolean> {
  try {
    await db.getFirstAsync("SELECT count(*) AS total FROM sqlite_master");
    return true;
  } catch {
    return false;
  }
}

async function countTables(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT count(*) AS total FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
  );

  return row?.total ?? 0;
}

/** `PRAGMA cipher_version` só responde quando o SQLCipher está compilado. */
async function hasSqlCipher(db: SQLite.SQLiteDatabase): Promise<boolean> {
  try {
    const row = await db.getFirstAsync<Record<string, string>>(
      "PRAGMA cipher_version"
    );
    return Boolean(row && Object.values(row)[0]);
  } catch {
    return false;
  }
}

function databaseDirectory(db: SQLite.SQLiteDatabase): string {
  return db.databasePath.slice(0, db.databasePath.lastIndexOf("/"));
}

/** Traz a cópia cifrada de volta para o banco principal e a descarta. */
async function importFromExport(
  db: SQLite.SQLiteDatabase,
  exportPath: string,
  escapedKey: string
): Promise<void> {
  await db.execAsync(
    `ATTACH DATABASE '${escapeSqlLiteral(exportPath)}' AS encrypted KEY '${escapedKey}'`
  );
  await db.execAsync("SELECT sqlcipher_export('main', 'encrypted')");
  await db.execAsync("DETACH DATABASE encrypted");

  await SQLite.deleteDatabaseAsync(ENCRYPTED_EXPORT_NAME).catch(() => {});
}

/**
 * Converte o banco em texto puro das versões anteriores.
 *
 * `PRAGMA rekey` — o que estava aqui antes — não faz isso: ele troca a chave de
 * um banco que já tem codec, e num arquivo em texto puro não faz nada. O
 * caminho suportado pelo SQLCipher é exportar para uma cópia cifrada.
 */
async function convertPlaintextDatabase(
  db: SQLite.SQLiteDatabase,
  escapedKey: string
): Promise<SQLite.SQLiteDatabase> {
  await db.closeAsync();

  const plain = await SQLite.openDatabaseAsync(DATABASE_NAME);

  if (!(await canReadSchema(plain))) {
    await plain.closeAsync();
    // Não abre com a chave e também não é texto puro. Pode ser chave perdida
    // (restauro de aparelho) ou arquivo corrompido: apagar aqui destruiria o
    // dado do usuário, então falhamos alto e deixamos a decisão para ele.
    throw new Error(
      "Banco de dados ilegível: a chave não abre o arquivo e ele não está em texto puro."
    );
  }

  const exportPath = `${databaseDirectory(plain)}/${ENCRYPTED_EXPORT_NAME}`;
  await SQLite.deleteDatabaseAsync(ENCRYPTED_EXPORT_NAME).catch(() => {});

  // Fecha o WAL antes de copiar: um `-wal` sobrevivendo à troca seria um
  // resíduo em texto puro do banco que acabamos de criptografar.
  await plain.execAsync("PRAGMA journal_mode = DELETE");

  await plain.execAsync(
    `ATTACH DATABASE '${escapeSqlLiteral(exportPath)}' AS encrypted KEY '${escapedKey}'`
  );
  await plain.execAsync("SELECT sqlcipher_export('encrypted')");
  await plain.execAsync("DETACH DATABASE encrypted");
  await plain.closeAsync();

  // A partir daqui o dado do usuário só existe na cópia cifrada: a marca é o
  // que permite retomar se o app morrer no meio.
  await markConversionPending();
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);

  const encrypted = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await encrypted.execAsync(`PRAGMA key = '${escapedKey}'`);
  await importFromExport(encrypted, exportPath, escapedKey);
  await clearConversionPending();

  return encrypted;
}

/**
 * Retoma uma conversão que morreu entre apagar o banco em texto puro e trazer a
 * cópia cifrada de volta. Só roda quando a marca diz que havia uma em curso —
 * antes isto disparava em toda instalação nova, que também tem o banco vazio, e
 * custava abrir, chavear, consultar, fechar e apagar um segundo banco no
 * primeiro lançamento do app.
 */
async function recoverInterruptedConversion(
  db: SQLite.SQLiteDatabase,
  escapedKey: string
): Promise<SQLite.SQLiteDatabase> {
  if (!(await isConversionPending())) {
    return db;
  }

  if ((await countTables(db)) === 0) {
    const exportPath = `${databaseDirectory(db)}/${ENCRYPTED_EXPORT_NAME}`;
    await importFromExport(db, exportPath, escapedKey);
  } else {
    // O import já tinha terminado; sobrou só a marca.
    await SQLite.deleteDatabaseAsync(ENCRYPTED_EXPORT_NAME).catch(() => {});
  }

  await clearConversionPending();
  return db;
}

/**
 * Devolve o handle já utilizável — pode não ser o mesmo que entrou, porque a
 * conversão precisa fechar e reabrir o arquivo.
 */
async function configureDatabaseEncryption(
  db: SQLite.SQLiteDatabase
): Promise<SQLite.SQLiteDatabase> {
  const key = await getDatabaseEncryptionKey();
  const escapedKey = escapeSqlLiteral(key);

  if (!(await hasSqlCipher(db))) {
    // Build sem SQLCipher: `PRAGMA key` é ignorado sem erro e o banco fica em
    // texto puro. Não convertemos nem marcamos nada — quando um build correto
    // chegar, a conversão acontece. O portão de verdade é a trava no
    // entrypoint de build. Este log fica fora de `__DEV__` de propósito: é
    // alarme de segurança e não carrega dado do usuário.
    console.error(
      "[database] SQLCipher ausente neste build — o banco NÃO está criptografado."
    );
    return db;
  }

  await db.execAsync(`PRAGMA key = '${escapedKey}'`);

  if (await canReadSchema(db)) {
    return recoverInterruptedConversion(db, escapedKey);
  }

  return convertPlaintextDatabase(db, escapedKey);
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const opened = await SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = await configureDatabaseEncryption(opened);

  await db.execAsync("PRAGMA journal_mode = WAL");
  await runMigrations(db);

  return db;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

export async function resetDatabaseForDev(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync("DELETE FROM tasks;");
  await db.execAsync("DELETE FROM sync_metadata;");
}
