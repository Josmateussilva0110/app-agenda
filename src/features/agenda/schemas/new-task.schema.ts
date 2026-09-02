import { z } from "zod";

import { TASK_PERIODS } from "@/types/task";
import { isTimeInPeriod, isValidTime } from "@/utils/task-time";

export const newTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Descreva o que você precisa fazer."),
    period: z.enum(TASK_PERIODS),
    time: z.string(),
    notify: z.boolean(),
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
