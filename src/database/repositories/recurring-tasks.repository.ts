import { getDatabase } from "@/database/client";
import type {
  CreateRecurringTaskInput,
  RecurringTask,
  UpdateRecurringTaskInput,
  Weekday,
} from "@/types/recurring-task";

type RecurringTaskRow = {
  id: string;
  title: string;
  description: string | null;
  time: string;
  weekdays: string;
  active: number;
  created_at: string;
  updated_at: string;
};

function mapRow(row: RecurringTaskRow): RecurringTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    time: row.time,
    weekdays: row.weekdays
      .split(",")
      .filter((value) => value.length > 0)
      .map((value) => Number(value) as Weekday),
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  );
}

export async function listRecurringTasks(): Promise<RecurringTask[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RecurringTaskRow>(
    "SELECT * FROM recurring_tasks ORDER BY time ASC, created_at ASC"
  );

  return rows.map(mapRow);
}

export async function createRecurringTask(
  input: CreateRecurringTaskInput
): Promise<RecurringTask> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = createId();

  await db.runAsync(
    `INSERT INTO recurring_tasks (
      id, title, description, time, weekdays, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      input.title.trim(),
      input.description?.trim() ?? null,
      input.time,
      input.weekdays.join(","),
      now,
      now,
    ]
  );

  const row = await db.getFirstAsync<RecurringTaskRow>(
    "SELECT * FROM recurring_tasks WHERE id = ?",
    [id]
  );

  if (!row) {
    throw new Error("Não foi possível criar a rotina.");
  }

  return mapRow(row);
}

export async function updateRecurringTask(
  id: string,
  input: UpdateRecurringTaskInput
): Promise<RecurringTask> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<RecurringTaskRow>(
    "SELECT * FROM recurring_tasks WHERE id = ?",
    [id]
  );

  if (!current) {
    throw new Error("Rotina não encontrada.");
  }

  const updatedAt = new Date().toISOString();

  await db.runAsync(
    `UPDATE recurring_tasks SET
      title = ?,
      description = ?,
      time = ?,
      weekdays = ?,
      active = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      input.title !== undefined ? input.title.trim() : current.title,
      input.description !== undefined
        ? (input.description?.trim() ?? null)
        : current.description,
      input.time ?? current.time,
      input.weekdays ? input.weekdays.join(",") : current.weekdays,
      input.active !== undefined ? (input.active ? 1 : 0) : current.active,
      updatedAt,
      id,
    ]
  );

  const row = await db.getFirstAsync<RecurringTaskRow>(
    "SELECT * FROM recurring_tasks WHERE id = ?",
    [id]
  );

  if (!row) {
    throw new Error("Rotina não encontrada após atualização.");
  }

  return mapRow(row);
}

export async function deleteRecurringTask(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM recurring_tasks WHERE id = ?", [id]);
}
