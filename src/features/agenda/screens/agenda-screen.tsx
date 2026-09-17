import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AgendaCalendar } from "@/features/agenda/components/agenda-calendar";
import { AgendaFab } from "@/features/agenda/components/agenda-fab";
import { DayPeriodSection } from "@/features/agenda/components/day-period-section";
import { GoogleAccountButton } from "@/features/agenda/components/google-account-button";
import { GoogleCalendarSyncPanel } from "@/features/agenda/components/google-calendar-sync-panel";
import { ThemeToggleButton } from "@/features/agenda/components/theme-toggle-button";
import { NewTaskModal } from "@/features/agenda/components/new-task-modal";
import { NotificationPermissionBanner } from "@/features/agenda/components/notification-permission-banner";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { useTaskMarkers } from "@/hooks/use-task-markers";
import { useTasks } from "@/hooks/use-tasks";
import { useTheme } from "@/context/theme.context";
import { TASK_PERIODS, type TaskPeriod } from "@/types/task";
import { formatDayMonth, isToday } from "@/utils/date";

export function AgendaScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);
  const {
    selectedDate,
    selectedDateKey,
    setSelectedDate,
    visibleMonth,
    goToPreviousMonth,
    goToNextMonth,
  } = useSelectedDate();
  const { markers, refresh: refreshMarkers } = useTaskMarkers(visibleMonth);
  const { tasks, loading, error, refresh, addTask, removeTask, toggleTaskComplete } =
    useTasks(selectedDateKey);
  const {
    configured: googleConfigured,
    connected: googleConnected,
    account: googleAccount,
    syncing: googleSyncing,
    error: googleError,
    lastResult: googleLastResult,
    connect: connectGoogle,
    disconnect: disconnectGoogle,
    sync: syncGoogle,
  } = useGoogleCalendar();
  const [refreshing, setRefreshing] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [, setBannerTick] = useState(0);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshMarkers()]);
    setRefreshing(false);
  }, [refresh, refreshMarkers]);

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

  const handleCreateTask = useCallback(
    async (input: Parameters<typeof addTask>[0]) => {
      const created = await addTask(input);
      if (created) {
        await refreshMarkers();
      }

      return created;
    },
    [addTask, refreshMarkers]
  );

  const handleRemoveTask = useCallback(
    async (taskId: string) => {
      if (await removeTask(taskId)) {
        await refreshMarkers();
      }
    },
    [refreshMarkers, removeTask]
  );

  const handleToggleComplete = useCallback(
    async (taskId: string) => {
      if (await toggleTaskComplete(taskId)) {
        await refreshMarkers();
      }
    },
    [refreshMarkers, toggleTaskComplete]
  );

  // connect/sync relançam de propósito: o hook já traduziu o motivo para
  // `googleError`, e o painel é quem mostra. Aqui só evitamos a rejeição solta.
  const handleGoogleConnect = useCallback(async () => {
    try {
      await connectGoogle();
    } catch {
      return;
    }
  }, [connectGoogle]);

  const handleGoogleDisconnect = useCallback(async () => {
    try {
      await disconnectGoogle();
    } catch {
      return;
    }
  }, [disconnectGoogle]);

  const handleGoogleSync = useCallback(async () => {
    try {
      await syncGoogle(selectedDateKey);
    } catch {
      return;
    }

    await Promise.all([refresh(), refreshMarkers()]);
  }, [refresh, refreshMarkers, selectedDateKey, syncGoogle]);

  const googleLastMessage = googleLastResult
    ? `${googleLastResult.imported} importado(s), ${googleLastResult.exported} exportado(s), ${googleLastResult.updated} atualizado(s).` +
      (googleLastResult.failed > 0
        ? ` ${googleLastResult.failed} não sincronizou(ram).`
        : "")
    : null;

  const googleSyncPanel = (
    <GoogleCalendarSyncPanel
      configured={googleConfigured}
      connected={googleConnected}
      syncing={googleSyncing}
      error={googleError}
      lastMessage={googleLastMessage}
      onConnect={handleGoogleConnect}
      onSync={handleGoogleSync}
    />
  );

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
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.todayLabel}>
              {isToday(selectedDate) ? "Hoje" : "Agenda"}
            </Text>
            <Text style={styles.title}>Minha Agenda</Text>
          </View>

          <View style={styles.headerActions}>
            <ThemeToggleButton />
            {googleConnected && googleAccount ? (
              <GoogleAccountButton
                account={googleAccount}
                onDisconnect={handleGoogleDisconnect}
              />
            ) : null}
          </View>
        </View>

        {googleConfigured && googleConnected ? googleSyncPanel : null}

        <NotificationPermissionBanner onEnabled={() => setBannerTick((v) => v + 1)} />

        {googleConfigured && !googleConnected ? googleSyncPanel : null}

        <View style={styles.calendarWrap}>
          <AgendaCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            visibleMonth={visibleMonth}
            onPreviousMonth={goToPreviousMonth}
            onNextMonth={goToNextMonth}
            markers={markers}
          />
        </View>

        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{formatDayMonth(selectedDate)}</Text>
          <Text style={styles.daySubtitle}>
            {emptyDay ? "Nenhuma tarefa neste dia" : `${tasks.length} tarefa(s)`}
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
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
        googleConnected={googleConnected}
        onClose={() => setNewTaskOpen(false)}
        onSubmit={handleCreateTask}
      />
    </SafeAreaView>
  );
}

const createStyles = (
  colors: ReturnType<typeof useTheme>["colors"],
  bottomInset: number
) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 96 + Math.max(bottomInset, 12),
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      marginTop: 8,
    },
    headerText: {
      flex: 1,
      minHeight: 64,
      justifyContent: "center",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    todayLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
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
      marginBottom: 12,
    },
  });
