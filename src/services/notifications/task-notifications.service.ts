import { Platform } from "react-native";

import { setTaskNotificationId } from "@/database/repositories/tasks.repository";
import {
  ensureNotificationPermission,
  getNotificationsModule,
  type NotificationsModule,
} from "@/services/notifications/notifications-core";
import { settingsStorage } from "@/storage/settings.storage";
import type { Task } from "@/types/task";
import { buildNotifyDate } from "@/utils/task-time";

const TASK_REMINDER_CHANNEL_ID = "task-reminders";

async function ensureNotificationChannel(
  Notifications: NotificationsModule
): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(TASK_REMINDER_CHANNEL_ID, {
    name: "Lembretes de tarefas",
    description: "Avisos no horário das suas tarefas",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0F172A",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
}

export async function initializeNotifications(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  await ensureNotificationChannel(Notifications);
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  try {
    await ensureNotificationChannel(Notifications);
    const granted = await ensureNotificationPermission(Notifications);
    await settingsStorage.setNotificationsEnabled(granted);
    return granted;
  } catch (error) {
    console.warn("[notifications] Permissão não disponível.", error);
    return false;
  }
}

export async function scheduleTaskNotification(task: Task): Promise<string | null> {
  if (!task.notifyAt) return null;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  const triggerDate = buildNotifyDate(task.date, task.notifyAt);
  if (triggerDate.getTime() <= Date.now()) {
    console.warn("[notifications] Horário já passou, lembrete não agendado.");
    return null;
  }

  try {
    await ensureNotificationChannel(Notifications);

    const granted = await ensureNotificationPermission(Notifications);
    if (!granted) {
      console.warn("[notifications] Permissão negada, lembrete não agendado.");
      return null;
    }

    await settingsStorage.setNotificationsEnabled(true);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Lembrete de tarefa",
        body: task.title,
        data: { taskId: task.id },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: TASK_REMINDER_CHANNEL_ID,
      },
    });

    await setTaskNotificationId(task.id, notificationId);
    return notificationId;
  } catch (error) {
    console.warn("[notifications] Não foi possível agendar lembrete.", error);
    return null;
  }
}

export async function cancelTaskNotification(notificationId: string | null): Promise<void> {
  if (!notificationId) return;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn("[notifications] Não foi possível cancelar lembrete.", error);
  }
}
