import { useMemo, useRef, useState } from "react";
import { CalendarDays, Share2 } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

import { AgendaFab } from "@/features/agenda/components/agenda-fab";
import { NewRecurringTaskModal } from "@/features/recurring/components/new-recurring-task-modal";
import { RecurringMatrix } from "@/features/recurring/components/recurring-matrix";
import { RecurringMatrixExportView } from "@/features/recurring/components/recurring-matrix-export-view";
import { useRecurringTasks } from "@/hooks/use-recurring-tasks";
import { useTheme } from "@/context/theme.context";
import type { RecurringTask } from "@/types/recurring-task";
import { formatDayMonth } from "@/utils/date";

export function RecurringScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    recurringTasks,
    loading,
    error,
    addRecurringTask,
    editRecurringTask,
    removeRecurringTask,
  } = useRecurringTasks();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportViewRef = useRef<View>(null);
  const editingTask = useMemo(
    () => recurringTasks.find((task) => task.id === editingTaskId) ?? null,
    [editingTaskId, recurringTasks]
  );

  const openCreateModal = () => {
    setEditingTaskId(null);
    setModalOpen(true);
  };

  const openEditModal = (task: RecurringTask) => {
    setEditingTaskId(task.id);
    setModalOpen(true);
  };

  const handleShare = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const uri = await captureRef(exportViewRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(
          "Não disponível",
          "Compartilhamento não está disponível neste dispositivo."
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Compartilhar rotina semanal",
      });
    } catch {
      Alert.alert("Erro", "Não foi possível gerar a imagem do mural.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.todayLabel}>Mural</Text>
          <Text style={styles.title} numberOfLines={1}>
            Rotina Semanal
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => void handleShare()}
            disabled={exporting}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            accessibilityLabel="Compartilhar mural"
            accessibilityRole="button"
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Share2 size={18} color={colors.text} />
            )}
          </Pressable>

          <View style={styles.dateBadge}>
            <CalendarDays size={14} color={colors.primary} />
            <Text style={styles.dateBadgeText}>{formatDayMonth(new Date())}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Cadastre atividades recorrentes e veja em quais dias e horários elas
        acontecem.
      </Text>

      <View style={styles.matrixCard}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <RecurringMatrix recurringTasks={recurringTasks} onPressTask={openEditModal} />
        )}
      </View>

      <AgendaFab onPress={openCreateModal} />

      <View style={styles.exportHidden} pointerEvents="none">
        <RecurringMatrixExportView
          ref={exportViewRef}
          recurringTasks={recurringTasks}
        />
      </View>

      <NewRecurringTaskModal
        visible={modalOpen}
        recurringTask={editingTask}
        onClose={() => setModalOpen(false)}
        onSubmit={addRecurringTask}
        onUpdate={editRecurringTask}
        onDelete={removeRecurringTask}
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
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingHorizontal: 20,
      marginTop: 8,
    },
    headerTextBlock: {
      flex: 1,
      flexShrink: 1,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
    },
    todayLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.6,
      marginTop: 4,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundElement,
      alignItems: "center",
      justifyContent: "center",
    },
    iconButtonPressed: {
      opacity: 0.7,
    },
    dateBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.primaryMuted,
    },
    dateBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    subtitle: {
      fontSize: 12.5,
      color: colors.textSecondary,
      paddingHorizontal: 20,
      marginTop: 8,
      lineHeight: 17,
    },
    matrixCard: {
      flex: 1,
      marginTop: 14,
      marginHorizontal: 20,
      marginBottom: 14,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingTop: 14,
      paddingHorizontal: 12,
      paddingBottom: 12,
      overflow: "hidden",
    },
    loadingBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      marginTop: 16,
    },
    exportHidden: {
      position: "absolute",
      top: 0,
      left: -4000,
    },
  });
