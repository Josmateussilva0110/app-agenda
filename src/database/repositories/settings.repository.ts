import { getDatabase } from "@/database/client";

export async function getSetting(
  key: string,
  fallback = ""
): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = ?",
    [key]
  );

  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  const updatedAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, updatedAt]
  );
}

export async function getBooleanSetting(
  key: string,
  fallback = false
): Promise<boolean> {
  const value = await getSetting(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export async function setBooleanSetting(
  key: string,
  value: boolean
): Promise<void> {
  await setSetting(key, value ? "true" : "false");
}

export async function loadAllSettings(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM app_settings"
  );

  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
