import { z } from "zod";

import { TASK_TITLE_MAX_LENGTH } from "@/constants/validation";
import { TASK_PERIODS } from "@/types/task";
import { isTimeInPeriod, isValidTime } from "@/utils/task-time";
import { GOOGLE_REMINDER_MINUTES_OPTIONS } from "@/constants/google-calendar";

const googleReminderMinutesSchema = z
  .number()
  .refine(
    (value) =>
      GOOGLE_REMINDER_MINUTES_OPTIONS.some((option) => option.minutes === value),
    "Escolha um lembrete válido para o Google Agenda."
  );

export const newTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Descreva o que você precisa fazer.")
      .max(
        TASK_TITLE_MAX_LENGTH,
        `Use no máximo ${TASK_TITLE_MAX_LENGTH} caracteres.`
      ),
    period: z.enum(TASK_PERIODS),
    time: z.string(),
    notify: z.boolean(),
    googleCalendarSync: z.boolean(),
    googleReminderMinutes: googleReminderMinutesSchema,
  })
  .superRefine((data, ctx) => {
    if (!isValidTime(data.time)) {
      ctx.addIssue({
        code: "custom",
        message: "Digite o horário no formato HH:MM (ex.: 09:30).",
        path: ["time"],
      });
      return;
    }

    if (!isTimeInPeriod(data.time, data.period)) {
      ctx.addIssue({
        code: "custom",
        message: "Escolha um horário dentro do período selecionado.",
        path: ["time"],
      });
    }
  });

export type NewTaskFormValues = z.infer<typeof newTaskSchema>;
