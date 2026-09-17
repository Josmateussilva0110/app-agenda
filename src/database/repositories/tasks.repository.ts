import { getDatabase } from "@/database/client";
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  truncateText,
} from "@/constants/validation";
import type {
  CreateTaskInput,
  Task,
  TaskPeriod,
  UpdateTaskInput,
} from "@/types/task";
import { buildGoogleCalendarSyncHash } from "@/utils/task-sync-hash";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  period: TaskPeriod;
  status: "pending" | "completed";
  notify_at: string | null;
  notification_id: string | null;
  google_event_id: string | null;
  google_calendar_sync: number;
  google_reminder_minutes: number | null;
  google_sync_hash: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    period: row.period,
    status: row.status,
    notifyAt: row.notify_at,
    notificationId: row.notification_id,
    googleEventId: row.google_event_id,
    googleCalendarSync: row.google_calendar_sync === 1,
    googleReminderMinutes: row.google_reminder_minutes,
    googleSyncHash: row.google_sync_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateKey(date: Date): string {
  return toDateString(date);
}

function normalizeCreateInput(input: CreateTaskInput): CreateTaskInput {
  return {
    ...input,
    title: truncateText(input.title, TASK_TITLE_MAX_LENGTH),
    description:
      input.description === undefined
        ? undefined
        : input.description === null
          ? null
          : truncateText(input.description, TASK_DESCRIPTION_MAX_LENGTH),
  };
}

export async function listTasksByDate(date: string): Promise<Task[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks WHERE date = ? ORDER BY
      CASE period
        WHEN 'manha' THEN 1
        WHEN 'tarde' THEN 2
        WHEN 'noite' THEN 3
      END,
      created_at ASC`,
    [date]
  );

  return rows.map(mapRow);
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const INSERT_TASK_SQL = `INSERT INTO tasks (
  id, title, description, date, period, status,
  notify_at, notification_id, google_event_id,
  google_calendar_sync, google_reminder_minutes, google_sync_hash,
  created_at, updated_at
) VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?, ?, ?, ?, ?)`;

/**
 * Monta os parâmetros do INSERT a partir do input, e devolve também o id para
 * quem precisar reler a linha. Existe para `createTask` e `createTasks`
 * gravarem exatamente do mesmo jeito.
 */
function buildInsertParams(input: CreateTaskInput): {
  id: string;
  params: (string | number | null)[];
} {
  const normalized = normalizeCreateInput(input);
  const now = new Date().toISOString();
  const id = createId();

  // Os valores que vão para o banco, calculados uma vez: o hash precisa ser
  // destes, e não do input cru, senão o corte de título faria o hash gravado
  // divergir do que a leitura recalcula.
  const title = normalized.title.trim();
  const description = normalized.description?.trim() ?? null;
  const notifyAt = normalized.notifyAt ?? null;
  const googleEventId = normalized.googleEventId ?? null;
  const googleReminderMinutes = normalized.googleReminderMinutes ?? null;

  // Tarefa que já chega com evento do Google veio de lá, e o conteúdo é o mesmo
  // que está no servidor. Sem o hash aqui, o sync seguinte veria "mudou desde a
  // última exportação" e devolveria o evento para o Google — reescrevendo
  // duração e lembretes de um evento que ninguém tocou.
  const googleSyncHash = googleEventId
    ? buildGoogleCalendarSyncHash({
        title,
        description,
        date: normalized.date,
        notifyAt,
        googleReminderMinutes,
      })
    : null;

  return {
    id,
    params: [
      id,
      title,
      description,
      normalized.date,
      normalized.period,
      notifyAt,
      googleEventId,
      normalized.googleCalendarSync ? 1 : 0,
      googleReminderMinutes,
      googleSyncHash,
      now,
      now,
    ],
  };
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = await getDatabase();
  const { id, params } = buildInsertParams(input);

  await db.runAsync(INSERT_TASK_SQL, params);

  const row = await db.getFirstAsync<TaskRow>(
    "SELECT * FROM tasks WHERE id = ?",
    [id]
  );

  if (!row) {
    throw new Error("Não foi possível criar a tarefa.");
  }

  return mapRow(row);
}

/**
 * Insere várias tarefas numa transação só e devolve quantas entraram.
 *
 * Serve o caminho de importação, onde o chamador não usa as linhas criadas: sem
 * isto era um INSERT mais um SELECT de releitura por evento, cada par no seu
 * próprio commit. Falha no meio desfaz o lote inteiro — o que é o certo aqui,
 * porque a próxima sincronização reimporta e `listExistingGoogleEventIds`
 * impede duplicata.
 */
export async function createTasks(inputs: CreateTaskInput[]): Promise<number> {
  if (inputs.length === 0) {
    return 0;
  }

  const db = await getDatabase();
  const rows = inputs.map(buildInsertParams);

  await db.withTransactionAsync(async () => {
    for (const { params } of rows) {
      await db.runAsync(INSERT_TASK_SQL, params);
    }
  });

  return rows.length;
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<Task> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<TaskRow>(
    "SELECT * FROM tasks WHERE id = ?",
    [id]
  );

  if (!current) {
    throw new Error("Tarefa não encontrada.");
  }

  const updatedAt = new Date().toISOString();
  const nextTitle =
    input.title !== undefined
      ? truncateText(input.title, TASK_TITLE_MAX_LENGTH)
      : current.title;
  const nextDescription =
    input.description !== undefined
      ? input.description === null
        ? null
        : truncateText(input.description, TASK_DESCRIPTION_MAX_LENGTH)
      : current.description;

  await db.runAsync(
    `UPDATE tasks SET
      title = ?,
      description = ?,
      date = ?,
      period = ?,
      status = ?,
      notify_at = ?,
      google_calendar_sync = ?,
      google_reminder_minutes = ?,
      google_sync_hash = CASE
        WHEN ? = 1 THEN NULL
        ELSE google_sync_hash
      END,
      updated_at = ?
    WHERE id = ?`,
    [
      nextTitle,
      nextDescription,
      input.date ?? current.date,
      input.period ?? current.period,
      input.status ?? current.status,
      input.notifyAt !== undefined ? input.notifyAt : current.notify_at,
      input.googleCalendarSync !== undefined
        ? input.googleCalendarSync
          ? 1
          : 0
        : current.google_calendar_sync,
      input.googleReminderMinutes !== undefined
        ? input.googleReminderMinutes
        : current.google_reminder_minutes,
      input.title !== undefined ||
      input.description !== undefined ||
      input.date !== undefined ||
      input.period !== undefined ||
      input.notifyAt !== undefined ||
      input.googleCalendarSync !== undefined ||
      input.googleReminderMinutes !== undefined
        ? 1
        : 0,
      updatedAt,
      id,
    ]
  );

  const row = await db.getFirstAsync<TaskRow>(
    "SELECT * FROM tasks WHERE id = ?",
    [id]
  );

  if (!row) {
    throw new Error("Tarefa não encontrada após atualização.");
  }

  return mapRow(row);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM tasks WHERE id = ?", [id]);
}

export async function setTaskNotificationId(
  id: string,
  notificationId: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE tasks SET notification_id = ? WHERE id = ?", [
    notificationId,
    id,
  ]);
}

export async function setTaskGoogleEventId(
  id: string,
  googleEventId: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE tasks SET google_event_id = ? WHERE id = ?", [
    googleEventId,
    id,
  ]);
}

export async function setTaskGoogleSyncHash(
  id: string,
  googleSyncHash: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE tasks SET google_sync_hash = ? WHERE id = ?", [
    googleSyncHash,
    id,
  ]);
}

export async function setTaskGoogleSyncState(
  id: string,
  googleEventId: string | null,
  googleSyncHash: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE tasks SET google_event_id = ?, google_sync_hash = ? WHERE id = ?`,
    [googleEventId, googleSyncHash, id]
  );
}

export type TaskGoogleSyncState = {
  id: string;
  googleEventId: string | null;
  googleSyncHash: string | null;
};

/** Mesma gravação, para um lote inteiro num commit só. */
export async function setTasksGoogleSyncState(
  states: TaskGoogleSyncState[]
): Promise<void> {
  if (states.length === 0) {
    return;
  }

  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (const state of states) {
      await db.runAsync(
        `UPDATE tasks SET google_event_id = ?, google_sync_hash = ? WHERE id = ?`,
        [state.googleEventId, state.googleSyncHash, state.id]
      );
    }
  });
}

export async function getTaskByGoogleEventId(
  googleEventId: string
): Promise<Task | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TaskRow>(
    "SELECT * FROM tasks WHERE google_event_id = ?",
    [googleEventId]
  );

  return row ? mapRow(row) : null;
}

export async function listExistingGoogleEventIds(
  googleEventIds: string[]
): Promise<Set<string>> {
  if (googleEventIds.length === 0) {
    return new Set();
  }

  const db = await getDatabase();
  const placeholders = googleEventIds.map(() => "?").join(", ");
  const rows = await db.getAllAsync<{ google_event_id: string }>(
    `SELECT google_event_id FROM tasks
     WHERE google_event_id IN (${placeholders})`,
    googleEventIds
  );

  return new Set(rows.map((row) => row.google_event_id));
}

export async function listTasksInDateRange(
  startDate: string,
  endDate: string
): Promise<Task[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks
     WHERE date >= ? AND date <= ?
     ORDER BY date ASC,
       CASE period
         WHEN 'manha' THEN 1
         WHEN 'tarde' THEN 2
         WHEN 'noite' THEN 3
       END,
       created_at ASC`,
    [startDate, endDate]
  );

  return rows.map(mapRow);
}
