export const DATABASE_NAME = "agenda.db";

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('manha', 'tarde', 'noite')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    notify_at TEXT,
    notification_id TEXT,
    google_event_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_date_period ON tasks(date, period);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`,
  `ALTER TABLE tasks ADD COLUMN notify_at TEXT;`,
  `ALTER TABLE tasks ADD COLUMN google_calendar_sync INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE tasks ADD COLUMN google_reminder_minutes INTEGER;`,
  `UPDATE tasks SET google_calendar_sync = 1 WHERE notify_at IS NOT NULL AND google_calendar_sync = 0;`,
  `ALTER TABLE tasks ADD COLUMN google_sync_hash TEXT;`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_google_event_id ON tasks(google_event_id);`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS recurring_tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    time TEXT NOT NULL,
    weekdays TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `ALTER TABLE tasks ADD COLUMN recurring_task_id TEXT;`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_recurring_task_id ON tasks(recurring_task_id, date);`,
] as const;
