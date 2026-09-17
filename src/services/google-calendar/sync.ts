import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  truncateText,
} from "@/constants/validation";
import {
  createTasks,
  listExistingGoogleEventIds,
  listTasksInDateRange,
  setTaskGoogleSyncState,
  setTasksGoogleSyncState,
  type TaskGoogleSyncState,
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

type ExportOutcome = "exported" | "updated" | "skipped" | "failed";

type ExportResult = {
  outcome: ExportOutcome;
  /** Só existe quando o Google aceitou: é o que o lote grava depois. */
  state?: TaskGoogleSyncState;
};

/**
 * Nunca lança: a falha de uma tarefa vira `failed` e as outras seguem. Antes o
 * erro subia pelo `Promise.all` de `runConcurrent` e derrubava a sincronização
 * inteira, mesmo com as demais já exportadas.
 */
async function exportTaskToGoogle(
  accessToken: string,
  task: Task
): Promise<ExportResult> {
  if (!shouldSyncTaskWithGoogle(task)) {
    return { outcome: "skipped" };
  }

  const payload = mapTaskToGoogleEvent(task);
  const nextHash = buildGoogleCalendarSyncHash(task);

  if (task.googleEventId && task.googleSyncHash === nextHash) {
    return { outcome: "skipped" };
  }

  try {
    if (task.googleEventId) {
      await updatePrimaryCalendarEvent(accessToken, task.googleEventId, payload);
      return {
        outcome: "updated",
        state: {
          id: task.id,
          googleEventId: task.googleEventId,
          googleSyncHash: nextHash,
        },
      };
    }

    const created = await createPrimaryCalendarEvent(accessToken, payload);
    if (!created.id) {
      return { outcome: "skipped" };
    }

    return {
      outcome: "exported",
      state: {
        id: task.id,
        googleEventId: created.id,
        googleSyncHash: nextHash,
      },
    };
  } catch (error) {
    if (__DEV__) {
      console.warn("[google-calendar] Falha ao exportar tarefa.", error);
    }

    return { outcome: "failed" };
  }
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

  // Junta primeiro, grava uma vez: um INSERT por evento, cada um no seu commit,
  // era o trecho que mais crescia com o tamanho da semana importada.
  const newTasks: CreateTaskInput[] = [];

  for (const event of events) {
    const input = mapGoogleEventToTaskInput(event);
    if (!input || existingIds.has(input.googleEventId)) continue;

    newTasks.push(input);
    existingIds.add(input.googleEventId);
  }

  const imported = await createTasks(newTasks);

  return imported;
}

async function exportTasks(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{ exported: number; updated: number; failed: number }> {
  const tasks = await listTasksInDateRange(startDate, endDate);
  const tasksToExport = tasks.filter(needsGoogleExport);
  const results = await runConcurrent(
    tasksToExport,
    GOOGLE_EXPORT_CONCURRENCY,
    (task) => exportTaskToGoogle(accessToken, task)
  );

  const states = results
    .map((result) => result.state)
    .filter((state): state is TaskGoogleSyncState => Boolean(state));

  await setTasksGoogleSyncState(states);

  const count = (outcome: ExportOutcome) =>
    results.filter((result) => result.outcome === outcome).length;

  return {
    exported: count("exported"),
    updated: count("updated"),
    failed: count("failed"),
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

  if (result.state) {
    await setTaskGoogleSyncState(
      result.state.id,
      result.state.googleEventId,
      result.state.googleSyncHash
    );
  }

  return result.outcome === "exported" || result.outcome === "updated";
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
  const { exported, updated, failed } = await exportTasks(accessToken, start, end);

  return { imported, exported, updated, failed };
}
