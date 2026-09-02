import type { TaskPeriod } from "@/types/task";

export const PERIOD_HOUR_RANGE: Record<TaskPeriod, { min: number; max: number }> = {
  manha: { min: 6, max: 11 },
  tarde: { min: 12, max: 17 },
  noite: { min: 18, max: 23 },
};

export const DEFAULT_PERIOD_TIME: Record<TaskPeriod, string> = {
  manha: "09:00",
  tarde: "14:00",
  noite: "19:00",
};

export function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;

  const { hour, minute } = parseTime(value);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function normalizeTimeInput(value: string): string {
  const formatted = formatTimeInput(value);
  if (!/^\d{2}:\d{2}$/.test(formatted)) return formatted;

  const { hour, minute } = parseTime(formatted);
  return formatTime(hour, minute);
}

export function isTimeInPeriod(time: string, period: TaskPeriod): boolean {
  const { hour } = parseTime(time);
  const range = PERIOD_HOUR_RANGE[period];
  return hour >= range.min && hour <= range.max;
}

export function clampTimeToPeriod(time: string, period: TaskPeriod): string {
  if (isTimeInPeriod(time, period)) return time;
  return DEFAULT_PERIOD_TIME[period];
}

export function periodFromHour(hour: number): TaskPeriod {
  if (hour >= PERIOD_HOUR_RANGE.manha.min && hour <= PERIOD_HOUR_RANGE.manha.max) {
    return "manha";
  }

  if (hour >= PERIOD_HOUR_RANGE.tarde.min && hour <= PERIOD_HOUR_RANGE.tarde.max) {
    return "tarde";
  }

  return "noite";
}

export function buildNotifyDate(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const { hour, minute } = parseTime(time);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}
