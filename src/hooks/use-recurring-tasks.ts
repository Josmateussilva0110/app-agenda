import { useCallback, useEffect, useRef, useState } from "react";

import {
  createRecurringTask,
  deleteRecurringTask,
  listRecurringTasks,
  updateRecurringTask,
} from "@/database/repositories/recurring-tasks.repository";
import { useWriteGuard } from "@/hooks/use-write-guard";
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
  const { error, setError, guard } = useWriteGuard();
  // Só a carga mais recente escreve no estado; a anterior é descartada.
  const loadIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await listRecurringTasks();
      if (loadId !== loadIdRef.current) return;
      setRecurringTasks(result);
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar rotinas.");
    } finally {
      if (loadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }, [setError]);

  useEffect(() => {
    void refresh();

    return () => {
      loadIdRef.current += 1;
    };
  }, [refresh]);

  const addRecurringTask = useCallback(
    async (input: CreateRecurringTaskInput) => {
      return guard(async () => {
        const created = await createRecurringTask(input);
        await scheduleRecurringTaskNotifications(created);
        await refresh();
        return created;
      }, "Não foi possível salvar a rotina.");
    },
    [guard, refresh]
  );

  const editRecurringTask = useCallback(
    async (id: string, input: UpdateRecurringTaskInput) => {
      return guard(async () => {
        const updated = await updateRecurringTask(id, input);
        await scheduleRecurringTaskNotifications(updated);
        await refresh();
        return updated;
      }, "Não foi possível salvar a rotina.");
    },
    [guard, refresh]
  );

  const removeRecurringTask = useCallback(
    async (id: string) => {
      const result = await guard(async () => {
        const current = recurringTasks.find((task) => task.id === id);
        if (current) {
          await cancelRecurringTaskNotifications(current.notificationIds);
        }

        await deleteRecurringTask(id);
        await refresh();
        return true;
      }, "Não foi possível excluir a rotina.");

      return result ?? false;
    },
    [guard, recurringTasks, refresh]
  );

  const toggleRecurringTaskActive = useCallback(
    async (id: string) => {
      const result = await guard(async () => {
        const current = recurringTasks.find((task) => task.id === id);
        if (!current) return false;

        const updated = await updateRecurringTask(id, { active: !current.active });
        await scheduleRecurringTaskNotifications(updated);
        await refresh();
        return true;
      }, "Não foi possível atualizar a rotina.");

      return result ?? false;
    },
    [guard, recurringTasks, refresh]
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
