import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CalendarSync, Link2, Unlink } from "lucide-react-native";

import { useTheme } from "@/context/theme.context";

type GoogleCalendarSyncPanelProps = {
  configured: boolean;
  connected: boolean;
  syncing: boolean;
  error: string | null;
  lastMessage: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSync: () => Promise<void>;
};

export function GoogleCalendarSyncPanel({
  configured,
  connected,
  syncing,
  error,
  lastMessage,
  onConnect,
  onDisconnect,
  onSync,
}: GoogleCalendarSyncPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!configured) {
    return (
      <View style={styles.card}>
        <CalendarSync size={18} color={colors.textSecondary} />
        <View style={styles.textBlock}>
          <Text style={styles.title}>Google Agenda</Text>
          <Text style={styles.subtitle}>
            Configure os Client IDs no `.env` para habilitar a sincronização.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <CalendarSync size={18} color={colors.primary} />
      <View style={styles.textBlock}>
        <Text style={styles.title}>Google Agenda</Text>
        <Text style={styles.subtitle}>
          {connected
            ? "Sincronize manualmente os eventos da semana."
            : "Conecte sua conta para importar e exportar eventos."}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {lastMessage ? <Text style={styles.successText}>{lastMessage}</Text> : null}

        <View style={styles.actions}>
          {!connected ? (
            <Pressable
              onPress={() => void onConnect()}
              disabled={syncing}
              style={[styles.button, styles.buttonPrimary]}
            >
              <Link2 size={16} color={colors.onPrimary} />
              <Text style={styles.buttonPrimaryText}>Conectar Google</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => void onSync()}
                disabled={syncing}
                style={[styles.button, styles.buttonPrimary]}
              >
                {syncing ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <CalendarSync size={16} color={colors.onPrimary} />
                )}
                <Text style={styles.buttonPrimaryText}>
                  {syncing ? "Sincronizando..." : "Sincronizar agenda"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void onDisconnect()}
                disabled={syncing}
                style={[styles.button, styles.buttonGhost]}
              >
                <Unlink size={16} color={colors.textSecondary} />
                <Text style={styles.buttonGhostText}>Desconectar</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginTop: 12,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    textBlock: {
      flex: 1,
      gap: 6,
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
    },
    successText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "600",
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
    },
    buttonPrimary: {
      backgroundColor: colors.primary,
    },
    buttonPrimaryText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.onPrimary,
    },
    buttonGhost: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundElement,
    },
    buttonGhostText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
  });
