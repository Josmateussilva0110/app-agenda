export const GOOGLE_REMINDER_MINUTES_OPTIONS = [
  { label: "Na hora", minutes: 0 },
  { label: "5 min antes", minutes: 5 },
  { label: "10 min antes", minutes: 10 },
  { label: "15 min antes", minutes: 15 },
  { label: "30 min antes", minutes: 30 },
  { label: "1 h antes", minutes: 60 },
] as const;

export type GoogleReminderMinutes =
  (typeof GOOGLE_REMINDER_MINUTES_OPTIONS)[number]["minutes"];

export const DEFAULT_GOOGLE_REMINDER_MINUTES: GoogleReminderMinutes = 10;

export function getGoogleReminderLabel(minutes: number): string {
  const option = GOOGLE_REMINDER_MINUTES_OPTIONS.find(
    (item) => item.minutes === minutes
  );
  return option?.label ?? `${minutes} min antes`;
}
