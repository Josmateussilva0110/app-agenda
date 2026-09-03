import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CalendarSync } from "lucide-react-native";

import { GoogleGIcon } from "@/features/agenda/components/google-g-icon";
import { useTheme } from "@/context/theme.context";

type GoogleCalendarSyncPanelProps = {
  configured: boolean;
  connected: boolean;
  syncing: boolean;
  error: string | null;
  lastMessage: string | null;
  onConnect: () => Promise<void>;
  onSync: () => Promise<void>;
};

export function GoogleCalendarSyncPanel({
  configured,
  connected,
  syncing,
  error,
  lastMessage,
  onConnect,
  onSync,
}: GoogleCalendarSyncPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!configured) {
    return (
      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <CalendarSync size={18} color={colors.textSecondary} />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>Google Agenda</Text>
          <Text style={styles.subtitle}>
            Configure os Client IDs no `.env` para habilitar a sincronização.
          </Text>
        </View>
      </View>
    );
  }

  if (!connected) {
    return (
      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <CalendarSync size={18} color={colors.primary} />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>Google Agenda</Text>
          <Text style={styles.subtitle}>
            Conecte sua conta para importar e exportar eventos.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={() => void onConnect()}
            disabled={syncing}
            style={[styles.connectButton, syncing && styles.buttonDisabled]}
          >
            {syncing ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <>
                <GoogleGIcon size={18} />
                <Text style={styles.connectButtonText}>Conectar Google</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.connectedWrap}>
      <View style={styles.connectedRow}>
        <Pressable
          onPress={() => void onSync()}
          disabled={syncing}
          style={[styles.syncButton, syncing && styles.buttonDisabled]}
          accessibilityLabel="Sincronizar Google Agenda"
        >
          {syncing ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <CalendarSync size={20} color={colors.primary} />
          )}
        </Pressable>

        {error || lastMessage ? (
          <View style={styles.statusWrap}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {lastMessage ? <Text style={styles.successText}>{lastMessage}</Text> : null}
          </View>
        ) : null}
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
      marginTop: 16,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    cardIcon: {
      width: 24,
      height: 24,
      marginTop: 1,
      alignItems: "center",
      justifyContent: "center",
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
      lineHeight: 16,
      color: colors.error,
    },
    successText: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.primary,
      fontWeight: "600",
    },
    connectButton: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginTop: 4,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundElement,
    },
    connectButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    connectedWrap: {
      marginTop: 12,
      width: "100%",
    },
    connectedRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 12,
    },
    statusWrap: {
      flex: 1,
      gap: 4,
      justifyContent: "center",
    },
    syncButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
