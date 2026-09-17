import * as SQLite from "expo-sqlite";

import {
  escapeSqlCipherKey,
  getDatabaseEncryptionKey,
  isDatabaseEncryptionMigrated,
  markDatabaseEncryptionMigrated,
} from "@/database/encryption";
import { SCHEMA_STATEMENTS, DATABASE_NAME } from "@/database/schema";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

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

async function verifyDatabaseAccess(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.getFirstAsync("SELECT 1 AS ok");
}

async function configureDatabaseEncryption(
  db: SQLite.SQLiteDatabase
): Promise<void> {
  const key = await getDatabaseEncryptionKey();
  const escapedKey = escapeSqlCipherKey(key);
  const migrated = await isDatabaseEncryptionMigrated();

  if (migrated) {
    await db.execAsync(`PRAGMA key = '${escapedKey}'`);
    await verifyDatabaseAccess(db);
    return;
  }

  let isPlaintextDatabase = false;

  try {
    await verifyDatabaseAccess(db);
    isPlaintextDatabase = true;
  } catch {
    isPlaintextDatabase = false;
  }

  if (isPlaintextDatabase) {
    await db.execAsync(`PRAGMA rekey = '${escapedKey}'`);
  } else {
    await db.execAsync(`PRAGMA key = '${escapedKey}'`);
    await verifyDatabaseAccess(db);
  }

  await markDatabaseEncryptionMigrated();
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await configureDatabaseEncryption(db);
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
