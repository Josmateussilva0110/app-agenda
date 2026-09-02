import { getDatabase } from "@/database/client";
import type {
  CreateTaskInput,
  Task,
  TaskPeriod,
  UpdateTaskInput,
} from "@/types/task";

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

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = createId();

  await db.runAsync(
    `INSERT INTO tasks (
      id, title, description, date, period, status,
      notify_at, notification_id, google_event_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?, ?)`,
    [
      id,
      input.title.trim(),
      input.description?.trim() ?? null,
      input.date,
      input.period,
      input.notifyAt ?? null,
      input.googleEventId ?? null,
      now,
      now,
    ]
  );

  const row = await db.getFirstAsync<TaskRow>(
    "SELECT * FROM tasks WHERE id = ?",
    [id]
  );

  if (!row) {
    throw new Error("Não foi possível criar a tarefa.");
  }

  return mapRow(row);
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

  await db.runAsync(
    `UPDATE tasks SET
      title = ?,
      description = ?,
      date = ?,
      period = ?,
      status = ?,
      notify_at = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      input.title ?? current.title,
      input.description !== undefined
        ? input.description
        : current.description,
      input.date ?? current.date,
      input.period ?? current.period,
      input.status ?? current.status,
      input.notifyAt !== undefined ? input.notifyAt : current.notify_at,
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
  await db.runAsync(
    "UPDATE tasks SET notification_id = ?, updated_at = ? WHERE id = ?",
    [notificationId, new Date().toISOString(), id]
  );
}

export async function setTaskGoogleEventId(
  id: string,
  googleEventId: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE tasks SET google_event_id = ?, updated_at = ? WHERE id = ?",
    [googleEventId, new Date().toISOString(), id]
  );
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

export async function listDatesWithTasks(
  year: number,
  month: number
): Promise<string[]> {
  const db = await getDatabase();
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const rows = await db.getAllAsync<{ date: string }>(
    "SELECT DISTINCT date FROM tasks WHERE date LIKE ? ORDER BY date ASC",
    [`${monthPrefix}%`]
  );

  return rows.map((row) => row.date);
}
