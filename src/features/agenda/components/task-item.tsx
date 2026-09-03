import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Circle, Trash2 } from "lucide-react-native";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTheme } from "@/context/theme.context";
import type { Task } from "@/types/task";

type TaskItemProps = {
  task: Task;
  onToggleComplete: (taskId: string) => Promise<void>;
  onRemove: (taskId: string) => Promise<void>;
};

export function TaskItem({ task, onToggleComplete, onRemove }: TaskItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCompleted = task.status === "completed";
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleConfirmRemove = async () => {
    setRemoving(true);

    try {
      await onRemove(task.id);
      setConfirmVisible(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <View style={[styles.taskItem, isCompleted && styles.taskItemCompleted]}>
        <Pressable
          onPress={() => void onToggleComplete(task.id)}
          hitSlop={8}
          style={styles.checkButton}
          accessibilityLabel={
            isCompleted ? `Desmarcar tarefa ${task.title}` : `Concluir tarefa ${task.title}`
          }
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isCompleted }}
        >
          {isCompleted ? (
            <View style={styles.checkIconFilled}>
              <Check size={14} color={colors.onPrimary} strokeWidth={3} />
            </View>
          ) : (
            <Circle size={22} color={colors.border} strokeWidth={2} />
          )}
        </Pressable>

        <View style={styles.content}>
          <Text style={[styles.taskTitle, isCompleted && styles.completedText]}>
            {task.title}
          </Text>
          {task.description ? (
            <Text style={[styles.taskDescription, isCompleted && styles.completedText]}>
              {task.description}
            </Text>
          ) : null}
          {task.notifyAt ? (
            <Text style={[styles.taskTime, isCompleted && styles.completedText]}>
              Lembrete às {task.notifyAt}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => setConfirmVisible(true)}
          hitSlop={8}
          style={styles.deleteButton}
          accessibilityLabel={`Remover tarefa ${task.title}`}
          accessibilityRole="button"
        >
          <Trash2 size={18} color={colors.danger} />
        </Pressable>
      </View>

      <ConfirmDialog
        visible={confirmVisible}
        title="Remover tarefa"
        message={`Deseja remover "${task.title}"?`}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        destructive
        loading={removing}
        onConfirm={() => void handleConfirmRemove()}
        onCancel={() => {
          if (!removing) {
            setConfirmVisible(false);
          }
        }}
      />
    </>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    taskItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.card,
      paddingLeft: 12,
      paddingRight: 10,
      paddingVertical: 12,
    },
    taskItemCompleted: {
      backgroundColor: colors.backgroundElement,
    },
    checkButton: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    checkIconFilled: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    content: {
      flex: 1,
      gap: 4,
    },
    taskTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    taskDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    taskTime: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    completedText: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    deleteButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.backgroundElement,
    },
  });
