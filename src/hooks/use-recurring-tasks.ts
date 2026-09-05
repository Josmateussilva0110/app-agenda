import { useCallback, useEffect, useState } from "react";

import {
  createRecurringTask,
  deleteRecurringTask,
  listRecurringTasks,
  updateRecurringTask,
} from "@/database/repositories/recurring-tasks.repository";
import {
  cancelRecurringTaskNotifications,
  scheduleRecurringTaskNotifications,
} from "@/services/notifications/recurring-task-notifications.service";
import type {
  CreateRecurringTaskInput,
  RecurringTask,
  UpdateRecurringTaskInput,
} from "@/types/recurring-task";

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
      await scheduleRecurringTaskNotifications(created);
      await refresh();
      return created;
    },
    [refresh]
  );

  const editRecurringTask = useCallback(
    async (id: string, input: UpdateRecurringTaskInput) => {
      const updated = await updateRecurringTask(id, input);
      await scheduleRecurringTaskNotifications(updated);
      await refresh();
      return updated;
    },
    [refresh]
  );

  const removeRecurringTask = useCallback(
    async (id: string) => {
      const current = recurringTasks.find((task) => task.id === id);
      if (current) {
        await cancelRecurringTaskNotifications(current.notificationIds);
      }

      await deleteRecurringTask(id);
      await refresh();
    },
    [recurringTasks, refresh]
  );

  const toggleRecurringTaskActive = useCallback(
    async (id: string) => {
      const current = recurringTasks.find((task) => task.id === id);
      if (!current) return;

      const updated = await updateRecurringTask(id, { active: !current.active });
      await scheduleRecurringTaskNotifications(updated);
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
