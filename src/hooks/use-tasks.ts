import { useCallback, useEffect, useRef, useState } from "react";

import {
  createTask,
  deleteTask,
  listTasksByDate,
  setTaskNotificationId,
  updateTask,
} from "@/database/repositories/tasks.repository";
import { useWriteGuard } from "@/hooks/use-write-guard";
import { googleCalendarService } from "@/services/google-calendar";
import {
  cancelTaskNotification,
  scheduleTaskNotification,
} from "@/services/notifications/task-notifications.service";
import type { CreateTaskInput, Task, UpdateTaskInput } from "@/types/task";

export function useTasks(date: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { error, setError, guard } = useWriteGuard();
  // Cada carga recebe um número; só a mais recente pode escrever no estado,
  // senão trocar de dia rápido deixa a resposta lenta do dia anterior vencer.
  const loadIdRef = useRef(0);
  // Qual data já está na tela. Recarregar a mesma data (depois de escrever, ou
  // quando o Google responde) não troca a lista por spinner: desmontar e
  // remontar todos os itens por uma consulta local de poucos milissegundos é o
  // que fazia a tela piscar duas vezes a cada tarefa criada.
  const loadedDateRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    if (loadedDateRef.current !== date) {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await listTasksByDate(date);
      if (loadId !== loadIdRef.current) return;
      setTasks(result);
      loadedDateRef.current = date;
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar tarefas.");
    } finally {
      if (loadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }, [date, setError]);

  useEffect(() => {
    void refresh();

    return () => {
      // Invalida a carga em voo quando a data muda ou a tela sai.
      loadIdRef.current += 1;
    };
  }, [refresh]);

  const addTask = useCallback(
    async (input: CreateTaskInput) => {
      return guard(async () => {
        const created = await createTask(input);
        await scheduleTaskNotification(created);
        await refresh();
        googleCalendarService.syncTaskInBackground(created, refresh);
        return created;
      }, "Não foi possível salvar a tarefa.");
    },
    [guard, refresh]
  );

  const editTask = useCallback(
    async (id: string, input: UpdateTaskInput) => {
      return guard(async () => {
        const current = tasks.find((task) => task.id === id);
        if (current?.notificationId) {
          await cancelTaskNotification(current.notificationId);
        }

        const updated = await updateTask(id, input);
        await scheduleTaskNotification(updated);
        await refresh();
        googleCalendarService.syncTaskInBackground(updated, refresh);
        return updated;
      }, "Não foi possível salvar a tarefa.");
    },
    [guard, refresh, tasks]
  );

  const removeTask = useCallback(
    async (id: string) => {
      const result = await guard(async () => {
        const current = tasks.find((task) => task.id === id);
        if (current?.notificationId) {
          await cancelTaskNotification(current.notificationId);
        }

        if (current?.googleEventId) {
          await googleCalendarService.deleteLinkedEvent(current.googleEventId);
        }

        await deleteTask(id);
        await refresh();
        return true;
      }, "Não foi possível excluir a tarefa.");

      return result ?? false;
    },
    [guard, refresh, tasks]
  );

  const toggleTaskComplete = useCallback(
    async (id: string) => {
      const result = await guard(async () => {
        const current = tasks.find((task) => task.id === id);
        if (!current) return false;

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
        googleCalendarService.syncTaskInBackground(updated, refresh);
        return true;
      }, "Não foi possível atualizar a tarefa.");

      return result ?? false;
    },
    [guard, refresh, tasks]
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
