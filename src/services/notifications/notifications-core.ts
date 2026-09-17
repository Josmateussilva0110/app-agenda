import { Platform } from "react-native";

export type NotificationsModule = typeof import("expo-notifications");

export async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === "web") return null;

  try {
    return await import("expo-notifications");
  } catch (error) {
    if (__DEV__) {
      console.warn("[notifications] Módulo indisponível.", error);
    }
    return null;
  }
}

export async function ensureNotificationPermission(
  Notifications: NotificationsModule
): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}
