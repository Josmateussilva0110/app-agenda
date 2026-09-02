import * as SQLite from "expo-sqlite";

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

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
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
