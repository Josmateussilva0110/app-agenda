import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Moon, Sun, Sunrise } from "lucide-react-native";

import { useTheme } from "@/context/theme.context";
import { TaskItem } from "@/features/agenda/components/task-item";
import {
  PERIOD_DESCRIPTIONS,
  PERIOD_LABELS,
  type Task,
  type TaskPeriod,
} from "@/types/task";

const PERIOD_ICONS: Record<TaskPeriod, typeof Sunrise> = {
  manha: Sunrise,
  tarde: Sun,
  noite: Moon,
};

type DayPeriodSectionProps = {
  period: TaskPeriod;
  tasks: Task[];
  onToggleComplete: (taskId: string) => Promise<void>;
  onRemoveTask: (taskId: string) => Promise<void>;
};

export function DayPeriodSection({
  period,
  tasks,
  onToggleComplete,
  onRemoveTask,
}: DayPeriodSectionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const Icon = PERIOD_ICONS[period];

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon size={18} color={colors.text} />
          <Text style={styles.title}>{PERIOD_LABELS[period]}</Text>
          <Text style={styles.subtitle}>{PERIOD_DESCRIPTIONS[period]}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{tasks.length}</Text>
        </View>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nada por aqui.</Text>
        </View>
      ) : (
        <View style={styles.taskList}>
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onRemove={onRemoveTask}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    section: {
      gap: 10,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    badge: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.periodBadgeBg,
      paddingHorizontal: 8,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.periodBadgeText,
    },
    emptyBox: {
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.emptyBorder,
      borderRadius: 16,
      backgroundColor: colors.emptyBackground,
      paddingVertical: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      fontSize: 14,
      color: colors.emptyText,
    },
    taskList: {
      gap: 8,
    },
  });
