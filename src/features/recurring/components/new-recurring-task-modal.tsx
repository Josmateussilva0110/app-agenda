import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Trash2, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { KeyboardSafeArea } from "@/components/keyboard-safe-area";
import { useTheme } from "@/context/theme.context";
import { WeekdayToggleGroup } from "@/features/recurring/components/weekday-toggle-group";
import { newRecurringTaskSchema } from "@/features/recurring/schemas/new-recurring-task.schema";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type {
  CreateRecurringTaskInput,
  RecurringTask,
  UpdateRecurringTaskInput,
  Weekday,
} from "@/types/recurring-task";
import { formatTimeInput, normalizeTimeInput } from "@/utils/task-time";

const KEYBOARD_LIFT_FACTOR = 0.5;
const SHEET_OFFSET = 420;

type FormValues = {
  title: string;
  time: string;
  weekdays: number[];
};

type NewRecurringTaskModalProps = {
  visible: boolean;
  recurringTask: RecurringTask | null;
  onClose: () => void;
  onSubmit: (input: CreateRecurringTaskInput) => Promise<unknown>;
  onUpdate: (id: string, input: UpdateRecurringTaskInput) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
};

function defaultValues(recurringTask: RecurringTask | null): FormValues {
  if (!recurringTask) {
    return { title: "", time: "", weekdays: [] };
  }

  return {
    title: recurringTask.title,
    time: recurringTask.time,
    weekdays: recurringTask.weekdays,
  };
}

export function NewRecurringTaskModal({
  visible,
  recurringTask,
  onClose,
  onSubmit,
  onUpdate,
  onDelete,
}: NewRecurringTaskModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mounted, setMounted] = useState(visible);
  const isEditing = recurringTask !== null;
  const { height: keyboardHeight } = useKeyboardInset(visible);
  const sheetLift = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(SHEET_OFFSET);

  useEffect(() => {
    sheetLift.value = withTiming(Math.round(keyboardHeight * KEYBOARD_LIFT_FACTOR), {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [keyboardHeight, sheetLift]);

  const finishClose = () => {
    setMounted(false);
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdropOpacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      sheetTranslateY.value = withSpring(0, {
        damping: 26,
        stiffness: 240,
        mass: 0.9,
      });
      return;
    }

    if (!mounted) return;

    backdropOpacity.value = withTiming(0, {
      duration: 180,
      easing: Easing.in(Easing.cubic),
    });
    sheetTranslateY.value = withTiming(
      SHEET_OFFSET,
      { duration: 200, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        }
      }
    );
  }, [backdropOpacity, mounted, sheetTranslateY, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
    marginBottom: sheetLift.value,
  }));

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(newRecurringTaskSchema),
    mode: "onChange",
    defaultValues: defaultValues(recurringTask),
  });

  useEffect(() => {
    if (visible) {
      reset(defaultValues(recurringTask));
    }
  }, [recurringTask, reset, visible]);

  const closeModal = () => {
    if (submitting || deleting) return;
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);

    try {
      const time = normalizeTimeInput(values.time);

      const weekdays = values.weekdays as Weekday[];

      if (isEditing) {
        await onUpdate(recurringTask.id, {
          title: values.title,
          time,
          weekdays,
        });
      } else {
        await onSubmit({
          title: values.title,
          time,
          weekdays,
        });
      }

      onClose();
    } finally {
      setSubmitting(false);
    }
  });

  const handleConfirmDelete = async () => {
    if (!recurringTask) return;
    setDeleting(true);

    try {
      await onDelete(recurringTask.id);
      setConfirmDeleteVisible(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      onRequestClose={closeModal}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeModal}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: 24 + Math.max(insets.bottom, 12) },
            sheetStyle,
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isEditing ? "Editar rotina" : "Nova rotina"}
            </Text>
            <Pressable onPress={closeModal} hitSlop={12} style={styles.closeButton}>
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={styles.field}>
              <Text style={styles.label}>Qual é a atividade?</Text>
              <Controller
                control={control}
                name="title"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Ex.: Ir para a academia"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    returnKeyType="done"
                  />
                )}
              />
              {errors.title ? (
                <Text style={styles.errorText}>{errors.title.message}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Horário</Text>
              <Controller
                control={control}
                name="time"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={[styles.timeRow, errors.time && styles.timeRowError]}>
                    <Clock size={18} color={colors.textSecondary} />
                    <TextInput
                      value={value}
                      onChangeText={(text) => onChange(formatTimeInput(text))}
                      onBlur={() => {
                        onChange(normalizeTimeInput(value));
                        onBlur();
                      }}
                      placeholder="19:30"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={5}
                      style={styles.timeInput}
                      returnKeyType="done"
                    />
                  </View>
                )}
              />
              {errors.time ? (
                <Text style={styles.errorText}>{errors.time.message}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Em quais dias?</Text>
              <Controller
                control={control}
                name="weekdays"
                render={({ field: { onChange, value } }) => (
                  <WeekdayToggleGroup
                    value={value as Weekday[]}
                    onChange={onChange}
                  />
                )}
              />
              {errors.weekdays ? (
                <Text style={styles.errorText}>{errors.weekdays.message}</Text>
              ) : null}
            </View>

            {isEditing ? (
              <View style={styles.notifyRow}>
                <Text style={styles.notifyTitle}>Rotina ativa</Text>
                <Switch
                  value={recurringTask.active}
                  onValueChange={(nextActive) =>
                    void onUpdate(recurringTask.id, { active: nextActive })
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.onPrimary}
                />
              </View>
            ) : null}

            <Pressable
              onPress={() => void submit()}
              disabled={!isValid || submitting}
              style={({ pressed }) => [
                styles.submitButton,
                (!isValid || submitting) && styles.submitButtonDisabled,
                pressed && styles.submitButtonPressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.submitText}>
                  {isEditing ? "Salvar alterações" : "Adicionar ao mural"}
                </Text>
              )}
            </Pressable>

            {isEditing ? (
              <Pressable
                onPress={() => setConfirmDeleteVisible(true)}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.deleteButtonPressed,
                ]}
              >
                <Trash2 size={16} color={colors.danger} />
                <Text style={styles.deleteButtonText}>Remover rotina</Text>
              </Pressable>
            ) : null}

            <KeyboardSafeArea inset={keyboardHeight} extra={16} />
          </ScrollView>
        </Animated.View>
      </View>

      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Remover rotina"
        message={`Deseja remover "${recurringTask?.title}" do mural? Essa ação não pode ser desfeita.`}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        destructive
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleting) setConfirmDeleteVisible(false);
        }}
      />
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(15, 23, 42, 0.45)",
    },
    sheet: {
      maxHeight: "88%",
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 20,
      paddingHorizontal: 20,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
    },
    closeButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      gap: 18,
      paddingBottom: 8,
    },
    field: {
      gap: 10,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.card,
    },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.card,
    },
    timeRowError: {
      borderColor: colors.error,
    },
    timeInput: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      padding: 0,
      minWidth: 64,
    },
    notifyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.card,
    },
    notifyTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    submitButton: {
      borderRadius: 16,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 54,
    },
    submitButtonDisabled: {
      backgroundColor: "#94A3B8",
    },
    submitButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.985 }],
    },
    submitText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.onPrimary,
    },
    deleteButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
    },
    deleteButtonPressed: {
      opacity: 0.6,
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.danger,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
    },
  });
