import * as SQLite from "expo-sqlite";

import {
  escapeSqlCipherKey,
  getDatabaseEncryptionKey,
  isDatabaseEncryptionMigrated,
  markDatabaseEncryptionMigrated,
} from "@/database/encryption";
import { SCHEMA_STATEMENTS, DATABASE_NAME } from "@/database/schema";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    try {
      await db.execAsync(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("duplicate column name")) {
        throw error;
      }
    }
  }
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
