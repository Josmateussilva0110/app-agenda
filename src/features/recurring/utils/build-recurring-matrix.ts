import type { RecurringTask } from "@/types/recurring-task";

export type RecurringMatrixData = {
  times: string[];
  cellsByDayAndTime: Map<string, RecurringTask[]>;
};

export function buildRecurringMatrix(
  recurringTasks: RecurringTask[]
): RecurringMatrixData {
  const uniqueTimes = new Set(recurringTasks.map((task) => task.time));
  const times = Array.from(uniqueTimes).sort((a, b) => a.localeCompare(b));

  const cellsByDayAndTime = new Map<string, RecurringTask[]>();
  for (const task of recurringTasks) {
    for (const day of task.weekdays) {
      const key = `${day}-${task.time}`;
      const list = cellsByDayAndTime.get(key) ?? [];
      list.push(task);
      cellsByDayAndTime.set(key, list);
    }
  }

  return { times, cellsByDayAndTime };
}
