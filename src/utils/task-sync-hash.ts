import type { Task } from "@/types/task";
import { DEFAULT_GOOGLE_REMINDER_MINUTES } from "@/constants/google-calendar";
import { buildNotifyDate } from "@/utils/task-time";

function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Os campos que descrevem o evento no Google. Recebe esse subconjunto, e não a
 * `Task` inteira, para o hash poder ser calculado na criação — antes de a linha
 * existir no banco.
 */
export type GoogleCalendarSyncHashInput = Pick<
  Task,
  "title" | "description" | "date" | "notifyAt" | "googleReminderMinutes"
>;

export function buildGoogleCalendarSyncHash(
  task: GoogleCalendarSyncHashInput
): string | null {
  if (!task.notifyAt) {
    return null;
  }

  const timeZone = getLocalTimeZone();
  const start = buildNotifyDate(task.date, task.notifyAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const reminderMinutes =
    task.googleReminderMinutes ?? DEFAULT_GOOGLE_REMINDER_MINUTES;

  return JSON.stringify({
    summary: task.title,
    description: task.description ?? null,
    start: start.toISOString(),
    end: end.toISOString(),
    timeZone,
    reminderMinutes,
  });
}
