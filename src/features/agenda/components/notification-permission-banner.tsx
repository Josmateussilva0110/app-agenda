import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Bell } from "lucide-react-native";

import { useTheme } from "@/context/theme.context";
import { requestNotificationPermissions } from "@/services/notifications/task-notifications.service";
import { settingsStorage } from "@/storage/settings.storage";

type NotificationPermissionBannerProps = {
  onEnabled?: () => void;
};

export function NotificationPermissionBanner({
  onEnabled,
}: NotificationPermissionBannerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (
    settingsStorage.getNotificationsEnabled() ||
    settingsStorage.getNotificationsPromptDismissed()
  ) {
    return null;
  }

  const handlePress = async () => {
    const granted = await requestNotificationPermissions();
    if (granted) {
      onEnabled?.();
      return;
    }

    await settingsStorage.setNotificationsPromptDismissed(true);
    onEnabled?.();
  };

  return (
    <Pressable onPress={() => void handlePress()} style={styles.banner}>
      <Bell size={16} color={colors.textSecondary} />
      <Text style={styles.text}>Ativar notificações das tarefas</Text>
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.notificationBannerBg,
      borderWidth: 1,
      borderColor: colors.notificationBannerBorder,
      marginTop: 12,
    },
    text: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
  });
