import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AgendaCalendar } from "@/features/agenda/components/agenda-calendar";
import { AgendaFab } from "@/features/agenda/components/agenda-fab";
import { DayPeriodSection } from "@/features/agenda/components/day-period-section";
import { GoogleCalendarSyncPanel } from "@/features/agenda/components/google-calendar-sync-panel";
import { NewTaskModal } from "@/features/agenda/components/new-task-modal";
import { NotificationPermissionBanner } from "@/features/agenda/components/notification-permission-banner";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { useTasks } from "@/hooks/use-tasks";
import { useTheme } from "@/context/theme.context";
import { listDatesWithTasks } from "@/database/repositories/tasks.repository";
import { TASK_PERIODS, type TaskPeriod } from "@/types/task";
import { formatDayMonth, isToday } from "@/utils/date";

export function AgendaScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { selectedDate, selectedDateKey, setSelectedDate } = useSelectedDate();
  const { tasks, loading, error, refresh, addTask, removeTask, toggleTaskComplete } =
    useTasks(selectedDateKey);
  const {
    configured: googleConfigured,
    connected: googleConnected,
    syncing: googleSyncing,
    error: googleError,
    lastResult: googleLastResult,
    connect: connectGoogle,
    disconnect: disconnectGoogle,
    sync: syncGoogle,
  } = useGoogleCalendar();
  const [markedDates, setMarkedDates] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [, setBannerTick] = useState(0);

  const loadMarkedDates = useCallback(async () => {
    const dates = await listDatesWithTasks(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1
    );
    setMarkedDates(dates);
  }, [selectedDate]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadMarkedDates()]);
    setRefreshing(false);
  }, [loadMarkedDates, refresh]);

  useEffect(() => {
    void loadMarkedDates();
  }, [loadMarkedDates]);

  const tasksByPeriod = useMemo(() => {
    const grouped: Record<TaskPeriod, typeof tasks> = {
      manha: [],
      tarde: [],
      noite: [],
    };

    for (const task of tasks) {
      grouped[task.period].push(task);
    }

    return grouped;
  }, [tasks]);

  const handleCreateTask = async (input: Parameters<typeof addTask>[0]) => {
    await addTask(input);
    await loadMarkedDates();
  };

  const handleRemoveTask = async (taskId: string) => {
    await removeTask(taskId);
    await loadMarkedDates();
  };

  const handleToggleComplete = async (taskId: string) => {
    await toggleTaskComplete(taskId);
  };

  const handleGoogleSync = async () => {
    await syncGoogle(selectedDateKey);
    await Promise.all([refresh(), loadMarkedDates()]);
  };

  const googleLastMessage = googleLastResult
    ? `${googleLastResult.imported} importado(s), ${googleLastResult.exported} exportado(s), ${googleLastResult.updated} atualizado(s).`
    : null;

  const emptyDay = tasks.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.todayLabel}>{isToday(selectedDate) ? "Hoje" : "Agenda"}</Text>
        <Text style={styles.title}>Minha Agenda</Text>

        <NotificationPermissionBanner onEnabled={() => setBannerTick((v) => v + 1)} />

        <GoogleCalendarSyncPanel
          configured={googleConfigured}
          connected={googleConnected}
          syncing={googleSyncing}
          error={googleError}
          lastMessage={googleLastMessage}
          onConnect={connectGoogle}
          onDisconnect={disconnectGoogle}
          onSync={handleGoogleSync}
        />

        <View style={styles.calendarWrap}>
          <AgendaCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            markedDates={markedDates}
          />
        </View>

        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{formatDayMonth(selectedDate)}</Text>
          <Text style={styles.daySubtitle}>
            {emptyDay ? "Nenhuma tarefa neste dia" : `${tasks.length} tarefa(s)`}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <View style={styles.periods}>
            {TASK_PERIODS.map((period) => (
              <DayPeriodSection
                key={period}
                period={period}
                tasks={tasksByPeriod[period]}
                onToggleComplete={handleToggleComplete}
                onRemoveTask={handleRemoveTask}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <AgendaFab onPress={() => setNewTaskOpen(true)} />

      <NewTaskModal
        visible={newTaskOpen}
        date={selectedDateKey}
        onClose={() => setNewTaskOpen(false)}
        onSubmit={handleCreateTask}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 120,
    },
    todayLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
      marginTop: 8,
    },
    title: {
      fontSize: 34,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.8,
      marginTop: 4,
    },
    calendarWrap: {
      marginTop: 20,
    },
    dayHeader: {
      marginTop: 24,
      marginBottom: 16,
      gap: 4,
    },
    dayTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
    },
    daySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    periods: {
      gap: 20,
    },
    loadingBox: {
      paddingVertical: 32,
      alignItems: "center",
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
    },
  });
