import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const DB_KEY_STORAGE = "database.encryption.key";
const DB_MIGRATED_STORAGE = "database.encryption.migrated";

export async function getDatabaseEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DB_KEY_STORAGE);
  if (existing) {
    return existing;
  }

  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  await SecureStore.setItemAsync(DB_KEY_STORAGE, key);
  return key;
}

export async function isDatabaseEncryptionMigrated(): Promise<boolean> {
  const migrated = await SecureStore.getItemAsync(DB_MIGRATED_STORAGE);
  return migrated === "true";
}

export async function markDatabaseEncryptionMigrated(): Promise<void> {
  await SecureStore.setItemAsync(DB_MIGRATED_STORAGE, "true");
}

export function escapeSqlCipherKey(key: string): string {
  return key.replace(/'/g, "''");
}
