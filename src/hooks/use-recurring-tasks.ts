import { useCallback, useEffect, useState } from "react";

import {
  createRecurringTask,
  deleteRecurringTask,
  listRecurringTasks,
  updateRecurringTask,
} from "@/database/repositories/recurring-tasks.repository";
import {
  deleteTask,
  listTasksByRecurringTaskId,
} from "@/database/repositories/tasks.repository";
import { googleCalendarService } from "@/services/google-calendar";
import { cancelTaskNotification } from "@/services/notifications/task-notifications.service";
import type {
  CreateRecurringTaskInput,
  RecurringTask,
  UpdateRecurringTaskInput,
} from "@/types/recurring-task";
import { runConcurrent } from "@/utils/concurrency";

const RECURRING_DELETE_CONCURRENCY = 8;

export function useRecurringTasks() {
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listRecurringTasks();
      setRecurringTasks(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar rotinas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addRecurringTask = useCallback(
    async (input: CreateRecurringTaskInput) => {
      const created = await createRecurringTask(input);
      await refresh();
      return created;
    },
    [refresh]
  );

  const editRecurringTask = useCallback(
    async (id: string, input: UpdateRecurringTaskInput) => {
      const updated = await updateRecurringTask(id, input);
      await refresh();
      return updated;
    },
    [refresh]
  );

  const removeRecurringTask = useCallback(
    async (id: string) => {
      const linkedTasks = await listTasksByRecurringTaskId(id);

      await runConcurrent(linkedTasks, RECURRING_DELETE_CONCURRENCY, async (task) => {
        if (task.notificationId) {
          await cancelTaskNotification(task.notificationId);
        }

        if (task.googleEventId) {
          await googleCalendarService.deleteLinkedEvent(task.googleEventId);
        }

        await deleteTask(task.id);
      });

      await deleteRecurringTask(id);
      await refresh();
    },
    [refresh]
  );

  const toggleRecurringTaskActive = useCallback(
    async (id: string) => {
      const current = recurringTasks.find((task) => task.id === id);
      if (!current) return;

      await updateRecurringTask(id, { active: !current.active });
      await refresh();
    },
    [recurringTasks, refresh]
  );

  return {
    recurringTasks,
    loading,
    error,
    refresh,
    addRecurringTask,
    editRecurringTask,
    removeRecurringTask,
    toggleRecurringTaskActive,
  };
}
