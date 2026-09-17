import { Platform } from "react-native";

import { setRecurringTaskNotificationIds } from "@/database/repositories/recurring-tasks.repository";
import {
  ensureNotificationPermission,
  getNotificationsModule,
  type NotificationsModule,
} from "@/services/notifications/notifications-core";
import { settingsStorage } from "@/storage/settings.storage";
import type { RecurringTask } from "@/types/recurring-task";
import { parseTime } from "@/utils/task-time";

const ROUTINE_REMINDER_CHANNEL_ID = "routine-reminders";

// O canal é o mesmo durante toda a sessão e criá-lo é uma ida ao módulo
// nativo. Guardar a promessa evita refazer a chamada a cada agendamento.
let channelPromise: Promise<void> | null = null;

async function ensureRoutineNotificationChannel(
  Notifications: NotificationsModule
): Promise<void> {
  if (Platform.OS !== "android") return;

  channelPromise ??= createChannel(Notifications).catch((error: unknown) => {
    // Falhou: esquece a promessa para a próxima tentativa refazer a chamada.
    channelPromise = null;
    throw error;
  });

  await channelPromise;
}

async function createChannel(
  Notifications: NotificationsModule
): Promise<void> {
  await Notifications.setNotificationChannelAsync(ROUTINE_REMINDER_CHANNEL_ID, {
    name: "Lembretes de rotina",
    description: "Avisos no horário das rotinas do mural",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0F172A",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
}

export async function cancelRecurringTaskNotifications(
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Promise.all(
    notificationIds.map((notificationId) =>
      Notifications.cancelScheduledNotificationAsync(notificationId).catch(
        (error) => {
          console.warn(
            "[notifications] Não foi possível cancelar lembrete de rotina.",
            error
          );
        }
      )
    )
  );
}

export async function scheduleRecurringTaskNotifications(
  task: RecurringTask
): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await cancelRecurringTaskNotifications(task.notificationIds);

  if (!task.notify || !task.active || task.weekdays.length === 0) {
    await setRecurringTaskNotificationIds(task.id, []);
    return;
  }

  try {
    await ensureRoutineNotificationChannel(Notifications);

    const granted = await ensureNotificationPermission(Notifications);
    if (!granted) {
      console.warn(
        "[notifications] Permissão negada, lembrete de rotina não agendado."
      );
      await setRecurringTaskNotificationIds(task.id, []);
      return;
    }

    await settingsStorage.setNotificationsEnabled(true);

    const { hour, minute } = parseTime(task.time);

    const notificationIds = await Promise.all(
      task.weekdays.map((weekday) =>
        Notifications.scheduleNotificationAsync({
          content: {
            title: "Lembrete de rotina",
            body: task.title,
            data: { recurringTaskId: task.id },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: weekday + 1,
            hour,
            minute,
            channelId: ROUTINE_REMINDER_CHANNEL_ID,
          },
        })
      )
    );

    await setRecurringTaskNotificationIds(task.id, notificationIds);
  } catch (error) {
    console.warn(
      "[notifications] Não foi possível agendar lembretes de rotina.",
      error
    );
  }
}
