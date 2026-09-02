import { useCallback, useEffect, useState } from "react";

import {
  createTask,
  deleteTask,
  listTasksByDate,
  setTaskNotificationId,
  updateTask,
} from "@/database/repositories/tasks.repository";
import { googleCalendarService } from "@/services/google-calendar";
import {
  cancelTaskNotification,
  scheduleTaskNotification,
} from "@/services/notifications/task-notifications.service";
import type { CreateTaskInput, Task, UpdateTaskInput } from "@/types/task";

export function useTasks(date: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listTasksByDate(date);
      setTasks(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar tarefas.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addTask = useCallback(
    async (input: CreateTaskInput) => {
      const created = await createTask(input);
      await scheduleTaskNotification(created);
      await refresh();
      return created;
    },
    [refresh]
  );

  const editTask = useCallback(
    async (id: string, input: UpdateTaskInput) => {
      const current = tasks.find((task) => task.id === id);
      if (current?.notificationId) {
        await cancelTaskNotification(current.notificationId);
      }

      const updated = await updateTask(id, input);
      await scheduleTaskNotification(updated);
      await refresh();
      return updated;
    },
    [refresh, tasks]
  );

  const removeTask = useCallback(
    async (id: string) => {
      const current = tasks.find((task) => task.id === id);
      if (current?.notificationId) {
        await cancelTaskNotification(current.notificationId);
      }

      if (current?.googleEventId) {
        await googleCalendarService.deleteLinkedEvent(current.googleEventId);
      }

      await deleteTask(id);
      await refresh();
    },
    [refresh, tasks]
  );

  const toggleTaskComplete = useCallback(
    async (id: string) => {
      const current = tasks.find((task) => task.id === id);
      if (!current) return;

      const nextStatus = current.status === "completed" ? "pending" : "completed";

      if (current.notificationId) {
        await cancelTaskNotification(current.notificationId);
        await setTaskNotificationId(id, null);
      }

      const updated = await updateTask(id, { status: nextStatus });

      if (nextStatus === "pending") {
        await scheduleTaskNotification(updated);
      }

      await refresh();
    },
    [refresh, tasks]
  );

  return {
    tasks,
    loading,
    error,
    refresh,
    addTask,
    editTask,
    removeTask,
    toggleTaskComplete,
  };
}
