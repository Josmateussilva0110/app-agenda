import {
  connectGoogleAccount,
  disconnectGoogleAccount,
  getGoogleAccountProfile,
  hasGoogleAccountConnected,
} from "@/services/google-calendar/auth";
import { isGoogleCalendarConfigured } from "@/services/google-calendar/config";
import {
  deleteLinkedGoogleCalendarEvent,
  syncGoogleCalendarForDate,
} from "@/services/google-calendar/sync";
import type {
  GoogleAccountProfile,
  GoogleCalendarSyncResult,
} from "@/services/google-calendar/types";
import { settingsStorage } from "@/storage/settings.storage";

export type GoogleCalendarSyncStatus = "idle" | "syncing" | "error";

export type { GoogleAccountProfile, GoogleCalendarSyncResult };

export const googleCalendarService = {
  isConfigured(): boolean {
    return isGoogleCalendarConfigured();
  },

  async isConnected(): Promise<boolean> {
    if (!settingsStorage.isGoogleCalendarConnected()) {
      return false;
    }

    return hasGoogleAccountConnected();
  },

  getAccountProfile(): GoogleAccountProfile | null {
    return getGoogleAccountProfile();
  },

  async connect(): Promise<void> {
    if (!isGoogleCalendarConfigured()) {
      throw new Error(
        "Google Agenda não configurado. Adicione os Client IDs no arquivo .env."
      );
    }

    await connectGoogleAccount();
    await settingsStorage.setGoogleCalendarConnected(true);
  },

  async disconnect(): Promise<void> {
    await disconnectGoogleAccount();
    await settingsStorage.setGoogleCalendarConnected(false);
  },

  async syncForDate(date: string): Promise<GoogleCalendarSyncResult> {
    const connected = await this.isConnected();
    if (!connected) {
      throw new Error("Conecte sua conta Google antes de sincronizar.");
    }

    return syncGoogleCalendarForDate(date);
  },

  async deleteLinkedEvent(googleEventId: string | null): Promise<void> {
    if (!googleEventId) {
      return;
    }

    const connected = await this.isConnected();
    if (!connected) {
      return;
    }

    try {
      await deleteLinkedGoogleCalendarEvent(googleEventId);
    } catch {
      // Mantém a exclusão local mesmo se o Google estiver indisponível.
    }
  },
};
