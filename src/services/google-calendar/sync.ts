import {
  createTask,
  getTaskByGoogleEventId,
  listTasksInDateRange,
  setTaskGoogleEventId,
  updateTask,
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
import { formatDateKey, getWeekRange, toDayEndIso, toDayStartIso } from "@/utils/date";
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
    title: event.summary?.trim() || "Evento do Google",
    description: event.description?.trim() || null,
    date,
    period: periodFromHour(parseTime(notifyAt).hour),
    notifyAt,
    googleEventId: event.id,
  };
}

function mapTaskToGoogleEvent(task: Task) {
  const timeZone = getLocalTimeZone();
  const start = buildNotifyDate(task.date, task.notifyAt!);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

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
      overrides: [{ method: "popup", minutes: 0 }],
    },
  };
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

  let imported = 0;

  for (const event of events) {
    const input = mapGoogleEventToTaskInput(event);
    if (!input) continue;

    const existing = await getTaskByGoogleEventId(input.googleEventId);
    if (existing) continue;

    await createTask(input);
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
  let exported = 0;
  let updated = 0;

  for (const task of tasks) {
    if (!task.notifyAt) continue;

    const payload = mapTaskToGoogleEvent(task);

    if (task.googleEventId) {
      await updatePrimaryCalendarEvent(accessToken, task.googleEventId, payload);
      updated += 1;
      continue;
    }

    const created = await createPrimaryCalendarEvent(accessToken, payload);
    if (!created.id) continue;

    await setTaskGoogleEventId(task.id, created.id);
    exported += 1;
  }

  return { exported, updated };
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
