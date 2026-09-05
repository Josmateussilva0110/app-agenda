import {
  loadAllSettings,
  setBooleanSetting,
  setSetting,
} from "@/database/repositories/settings.repository";

const KEYS = {
  notificationsEnabled: "settings.notifications.enabled",
  notificationsPromptDismissed: "settings.notifications.promptDismissed",
  selectedDate: "agenda.selectedDate",
  googleCalendarConnected: "integrations.googleCalendar.connected",
  googleCalendarSyncEnabled: "integrations.googleCalendar.syncEnabled",
  googleCalendarReminderMinutes: "integrations.googleCalendar.reminderMinutes",
  theme: "settings.theme",
} as const;

const cache = new Map<string, string>();

export async function hydrateSettingsCache(): Promise<void> {
  const settings = await loadAllSettings();
  cache.clear();
  for (const [key, value] of Object.entries(settings)) {
    cache.set(key, value);
  }
}

function getCachedString(key: string, fallback = ""): string {
  return cache.get(key) ?? fallback;
}

function getCachedBoolean(key: string, fallback = false): boolean {
  const value = cache.get(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

async function writeString(key: string, value: string): Promise<void> {
  cache.set(key, value);
  await setSetting(key, value);
}

async function writeBoolean(key: string, value: boolean): Promise<void> {
  const serialized = value ? "true" : "false";
  cache.set(key, serialized);
  await setBooleanSetting(key, value);
}

export const settingsStorage = {
  getNotificationsEnabled(): boolean {
    return getCachedBoolean(KEYS.notificationsEnabled, false);
  },

  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    await writeBoolean(KEYS.notificationsEnabled, enabled);
  },

  getNotificationsPromptDismissed(): boolean {
    return getCachedBoolean(KEYS.notificationsPromptDismissed, false);
  },

  async setNotificationsPromptDismissed(dismissed: boolean): Promise<void> {
    await writeBoolean(KEYS.notificationsPromptDismissed, dismissed);
  },

  getSelectedDate(): string | null {
    const value = getCachedString(KEYS.selectedDate);
    return value.length > 0 ? value : null;
  },

  async setSelectedDate(date: string): Promise<void> {
    await writeString(KEYS.selectedDate, date);
  },

  isGoogleCalendarConnected(): boolean {
    return getCachedBoolean(KEYS.googleCalendarConnected, false);
  },

  async setGoogleCalendarConnected(connected: boolean): Promise<void> {
    await writeBoolean(KEYS.googleCalendarConnected, connected);
  },

  getGoogleCalendarSyncEnabled(): boolean {
    return getCachedBoolean(KEYS.googleCalendarSyncEnabled, true);
  },

  async setGoogleCalendarSyncEnabled(enabled: boolean): Promise<void> {
    await writeBoolean(KEYS.googleCalendarSyncEnabled, enabled);
  },

  getGoogleCalendarReminderMinutes(): number {
    const value = Number(getCachedString(KEYS.googleCalendarReminderMinutes, "10"));
    return Number.isFinite(value) ? value : 10;
  },

  async setGoogleCalendarReminderMinutes(minutes: number): Promise<void> {
    await writeString(KEYS.googleCalendarReminderMinutes, String(minutes));
  },

  getTheme(): "light" | "dark" | null {
    const value = getCachedString(KEYS.theme);
    if (value === "light" || value === "dark") return value;
    return null;
  },

  async setTheme(theme: "light" | "dark"): Promise<void> {
    await writeString(KEYS.theme, theme);
  },
};
