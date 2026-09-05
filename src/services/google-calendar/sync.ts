import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  truncateText,
} from "@/constants/validation";
import {
  createTask,
  listExistingGoogleEventIds,
  listTasksInDateRange,
  setTaskGoogleSyncState,
} from "@/database/repositories/tasks.repository";
import {
  createPrimaryCalendarEvent,
  deletePrimaryCalendarEvent,
  listPrimaryCalendarEvents,
  updatePrimaryCalendarEvent,
} from "@/services/google-calendar/calendar-api";
import { getGoogleAccessToken } from "@/services/google-calendar/auth";
import type {
  GoogleCalendarEvent,
  GoogleCalendarSyncResult,
} from "@/services/google-calendar/types";
import type { CreateTaskInput, Task } from "@/types/task";
import { DEFAULT_GOOGLE_REMINDER_MINUTES } from "@/constants/google-calendar";
import { formatDateKey, getWeekRange, toDayEndIso, toDayStartIso } from "@/utils/date";
import { runConcurrent } from "@/utils/concurrency";
import { buildGoogleCalendarSyncHash } from "@/utils/task-sync-hash";
import {
  buildNotifyDate,
  formatTime,
  parseTime,
  periodFromHour,
} from "@/utils/task-time";

function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function mapGoogleEventToTaskInput(
  event: GoogleCalendarEvent
): (CreateTaskInput & { googleEventId: string }) | null {
  if (!event.id || event.status === "cancelled") {
    return null;
  }

  let date: string;
  let notifyAt: string;

  if (event.start.dateTime) {
    const start = new Date(event.start.dateTime);
    date = formatDateKey(start);
    notifyAt = formatTime(start.getHours(), start.getMinutes());
  } else if (event.start.date) {
    date = event.start.date;
    notifyAt = "09:00";
  } else {
    return null;
  }

  return {
    title: truncateText(
      event.summary?.trim() || "Evento do Google",
      TASK_TITLE_MAX_LENGTH
    ),
    description: event.description
      ? truncateText(event.description, TASK_DESCRIPTION_MAX_LENGTH)
      : null,
    date,
    period: periodFromHour(parseTime(notifyAt).hour),
    notifyAt,
    googleEventId: event.id,
    googleCalendarSync: true,
    googleReminderMinutes: DEFAULT_GOOGLE_REMINDER_MINUTES,
  };
}

function mapTaskToGoogleEvent(task: Task) {
  const timeZone = getLocalTimeZone();
  const start = buildNotifyDate(task.date, task.notifyAt!);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const reminderMinutes =
    task.googleReminderMinutes ?? DEFAULT_GOOGLE_REMINDER_MINUTES;

  return {
    summary: task.title,
    description: task.description ?? undefined,
    start: {
      dateTime: start.toISOString(),
      timeZone,
    },
    end: {
      dateTime: end.toISOString(),
      timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: reminderMinutes }],
    },
  };
}

function shouldSyncTaskWithGoogle(task: Task): boolean {
  return Boolean(task.notifyAt && task.googleCalendarSync);
}

function needsGoogleExport(task: Task): boolean {
  if (!shouldSyncTaskWithGoogle(task)) {
    return false;
  }

  const nextHash = buildGoogleCalendarSyncHash(task);
  return !(task.googleEventId && task.googleSyncHash === nextHash);
}

const GOOGLE_EXPORT_CONCURRENCY = 8;

async function persistGoogleSyncState(
  task: Task,
  googleEventId: string | null
): Promise<void> {
  const syncHash = googleEventId ? buildGoogleCalendarSyncHash(task) : null;
  await setTaskGoogleSyncState(task.id, googleEventId, syncHash);
}

async function exportTaskToGoogle(
  accessToken: string,
  task: Task
): Promise<"exported" | "updated" | "skipped"> {
  if (!shouldSyncTaskWithGoogle(task)) {
    return "skipped";
  }

  const payload = mapTaskToGoogleEvent(task);
  const nextHash = buildGoogleCalendarSyncHash(task);

  if (task.googleEventId && task.googleSyncHash === nextHash) {
    return "skipped";
  }

  if (task.googleEventId) {
    await updatePrimaryCalendarEvent(accessToken, task.googleEventId, payload);
    await persistGoogleSyncState(task, task.googleEventId);
    return "updated";
  }

  const created = await createPrimaryCalendarEvent(accessToken, payload);
  if (!created.id) {
    return "skipped";
  }

  await persistGoogleSyncState(task, created.id);
  return "exported";
}

async function importEvents(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const events = await listPrimaryCalendarEvents(
    accessToken,
    toDayStartIso(startDate),
    toDayEndIso(endDate)
  );

  const eventIds = events
    .map((event) => event.id)
    .filter((eventId): eventId is string => Boolean(eventId));
  const existingIds = await listExistingGoogleEventIds(eventIds);

  let imported = 0;

  for (const event of events) {
    const input = mapGoogleEventToTaskInput(event);
    if (!input || existingIds.has(input.googleEventId)) continue;

    await createTask(input);
    existingIds.add(input.googleEventId);
    imported += 1;
  }

  return imported;
}

async function exportTasks(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{ exported: number; updated: number }> {
  const tasks = await listTasksInDateRange(startDate, endDate);
  const tasksToExport = tasks.filter(needsGoogleExport);
  const results = await runConcurrent(
    tasksToExport,
    GOOGLE_EXPORT_CONCURRENCY,
    (task) => exportTaskToGoogle(accessToken, task)
  );

  return {
    exported: results.filter((result) => result === "exported").length,
    updated: results.filter((result) => result === "updated").length,
  };
}

export async function deleteLinkedGoogleCalendarEvent(
  googleEventId: string
): Promise<void> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return;
  }

  await deletePrimaryCalendarEvent(accessToken, googleEventId);
}

export async function syncTaskWithGoogleCalendar(task: Task): Promise<boolean> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return false;
  }

  if (!shouldSyncTaskWithGoogle(task)) {
    if (task.googleEventId) {
      await deletePrimaryCalendarEvent(accessToken, task.googleEventId);
      await persistGoogleSyncState(task, null);
      return true;
    }

    return false;
  }

  const result = await exportTaskToGoogle(accessToken, task);
  return result === "exported" || result === "updated";
}

export async function syncGoogleCalendarForDate(
  anchorDate: string
): Promise<GoogleCalendarSyncResult> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    throw new Error("Conecte sua conta Google antes de sincronizar.");
  }

  const { start, end } = getWeekRange(anchorDate);
  const imported = await importEvents(accessToken, start, end);
  const { exported, updated } = await exportTasks(accessToken, start, end);

  return { imported, exported, updated };
}
