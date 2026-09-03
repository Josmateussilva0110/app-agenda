import { useCallback, useEffect, useState } from "react";

import {
  googleCalendarService,
  type GoogleAccountProfile,
  type GoogleCalendarSyncResult,
} from "@/services/google-calendar";
import { settingsStorage } from "@/storage/settings.storage";

export function useGoogleCalendar() {
  const [configured, setConfigured] = useState(
    googleCalendarService.isConfigured()
  );
  const [connected, setConnected] = useState(
    settingsStorage.isGoogleCalendarConnected()
  );
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<GoogleCalendarSyncResult | null>(
    null
  );
  const [account, setAccount] = useState<GoogleAccountProfile | null>(null);

  const refreshConnection = useCallback(async () => {
    setConfigured(googleCalendarService.isConfigured());
    const isConnected = await googleCalendarService.isConnected();
    setConnected(isConnected);
    setAccount(isConnected ? googleCalendarService.getAccountProfile() : null);

    if (!isConnected && settingsStorage.isGoogleCalendarConnected()) {
      await settingsStorage.setGoogleCalendarConnected(false);
    }
  }, []);

  useEffect(() => {
    void refreshConnection();
  }, [refreshConnection]);

  useEffect(() => {
    if (!lastResult) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setLastResult(null);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [lastResult]);

  const connect = useCallback(async () => {
    setError(null);

    try {
      await googleCalendarService.connect();
      setConnected(true);
      setAccount(googleCalendarService.getAccountProfile());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao conectar Google Agenda.";
      setError(message);
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    setLastResult(null);

    try {
      await googleCalendarService.disconnect();
      setConnected(false);
      setAccount(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao desconectar Google Agenda.";
      setError(message);
      throw err;
    }
  }, []);

  const sync = useCallback(async (date: string) => {
    setSyncing(true);
    setError(null);

    try {
      const result = await googleCalendarService.syncForDate(date);
      setLastResult(result);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao sincronizar Google Agenda.";
      setError(message);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    configured,
    connected,
    account,
    syncing,
    error,
    lastResult,
    connect,
    disconnect,
    sync,
    refreshConnection,
  };
}
