export const TASK_PERIODS = ["manha", "tarde", "noite"] as const;

export type TaskPeriod = (typeof TASK_PERIODS)[number];

export const PERIOD_LABELS: Record<TaskPeriod, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export const PERIOD_DESCRIPTIONS: Record<TaskPeriod, string> = {
  manha: "até 12h",
  tarde: "12h – 18h",
  noite: "após 18h",
};

export type TaskStatus = "pending" | "completed";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  period: TaskPeriod;
  status: TaskStatus;
  notifyAt: string | null;
  notificationId: string | null;
  googleEventId: string | null;
  googleCalendarSync: boolean;
  googleReminderMinutes: number | null;
  googleSyncHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  date: string;
  period: TaskPeriod;
  notifyAt?: string | null;
  googleEventId?: string | null;
  googleCalendarSync?: boolean;
  googleReminderMinutes?: number | null;
};

export type UpdateTaskInput = Partial<
  Pick<Task, "title" | "description" | "date" | "period" | "status">
> & {
  notifyAt?: string | null;
  googleCalendarSync?: boolean;
  googleReminderMinutes?: number | null;
};
