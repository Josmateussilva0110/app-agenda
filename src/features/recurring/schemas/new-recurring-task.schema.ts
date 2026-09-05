import { z } from "zod";

import { TASK_TITLE_MAX_LENGTH } from "@/constants/validation";
import { isValidTime } from "@/utils/task-time";

export const newRecurringTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Descreva a atividade.")
    .max(
      TASK_TITLE_MAX_LENGTH,
      `Use no máximo ${TASK_TITLE_MAX_LENGTH} caracteres.`
    ),
  time: z
    .string()
    .refine(isValidTime, "Digite o horário no formato HH:MM (ex.: 19:30)."),
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Escolha ao menos um dia da semana."),
  notify: z.boolean(),
});

export type NewRecurringTaskFormValues = z.infer<typeof newRecurringTaskSchema>;
