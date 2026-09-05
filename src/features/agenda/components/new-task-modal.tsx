import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, CalendarSync, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Keyboard,
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

import { KeyboardSafeArea } from "@/components/keyboard-safe-area";
import { useTheme } from "@/context/theme.context";
import { PeriodPicker } from "@/features/agenda/components/period-picker";
import { GoogleReminderPicker } from "@/features/agenda/components/google-reminder-picker";
import { TaskTimePicker } from "@/features/agenda/components/task-time-picker";
import {
  newTaskSchema,
  type NewTaskFormValues,
} from "@/features/agenda/schemas/new-task.schema";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { requestNotificationPermissions } from "@/services/notifications/task-notifications.service";
import { settingsStorage } from "@/storage/settings.storage";
import { DEFAULT_GOOGLE_REMINDER_MINUTES, GOOGLE_REMINDER_MINUTES_OPTIONS } from "@/constants/google-calendar";
import type { CreateTaskInput } from "@/types/task";
import { clampTimeToPeriod, DEFAULT_PERIOD_TIME, normalizeTimeInput } from "@/utils/task-time";

const SHEET_OFFSET = 420;
const KEYBOARD_SAFE_EXTRA = 16;
const SHEET_LIFT_FACTOR = 0.48;

function toSheetLift(keyboardHeight: number) {
  if (keyboardHeight <= 0) return 0;
  return Math.round(keyboardHeight * SHEET_LIFT_FACTOR);
}

type FocusedField = "title" | "time" | null;

type NewTaskModalProps = {
  visible: boolean;
  date: string;
  googleConnected: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
};

function getDefaultFormValues(): NewTaskFormValues {
  const reminderMinutes = settingsStorage.getGoogleCalendarReminderMinutes();
  const validReminder = GOOGLE_REMINDER_MINUTES_OPTIONS.some(
    (option) => option.minutes === reminderMinutes
  )
    ? reminderMinutes
    : DEFAULT_GOOGLE_REMINDER_MINUTES;

  return {
    title: "",
    period: "manha",
    time: DEFAULT_PERIOD_TIME.manha,
    notify: settingsStorage.getNotificationsEnabled(),
    googleCalendarSync: settingsStorage.getGoogleCalendarSyncEnabled(),
    googleReminderMinutes: validReminder as NewTaskFormValues["googleReminderMinutes"],
  };
}

export function NewTaskModal({
  visible,
  date,
  googleConnected,
  onClose,
  onSubmit,
}: NewTaskModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = Math.max(insets.bottom, 12);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(visible);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const { height: keyboardHeight, readCurrentHeight } = useKeyboardInset(visible);

  const scrollRef = useRef<ScrollView>(null);
  const titleInputRef = useRef<TextInput>(null);
  const timeInputRef = useRef<TextInput>(null);
  const timeFieldOffsetRef = useRef(0);
  const reopeningKeyboardRef = useRef(false);

  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(SHEET_OFFSET);
  const sheetKeyboardLift = useSharedValue(0);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors, isValid },
  } = useForm<NewTaskFormValues>({
    resolver: zodResolver(newTaskSchema),
    mode: "onChange",
    defaultValues: getDefaultFormValues(),
  });

  const period = watch("period");
  const notifyEnabled = watch("notify");
  const googleCalendarSyncEnabled = watch("googleCalendarSync");
  const showGoogleOptions = googleConnected && notifyEnabled;

  const applySheetLift = useCallback(
    (height: number) => {
      sheetKeyboardLift.value = withTiming(toSheetLift(height), {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    },
    [sheetKeyboardLift]
  );

  const scrollToTimeField = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, timeFieldOffsetRef.current - KEYBOARD_SAFE_EXTRA),
        animated: true,
      });
    }, 100);
  }, []);

  const dismissFormKeyboard = useCallback(() => {
    titleInputRef.current?.blur();
    timeInputRef.current?.blur();
    setFocusedField(null);
    Keyboard.dismiss();
  }, []);

  const focusTimeField = useCallback(() => {
    setFocusedField("time");

    const estimatedHeight = readCurrentHeight();
    if (estimatedHeight > 0) {
      applySheetLift(estimatedHeight);
      scrollToTimeField();
    }

    if (keyboardHeight > 0) {
      timeInputRef.current?.focus();
      return;
    }

    reopeningKeyboardRef.current = true;
    timeInputRef.current?.blur();

    setTimeout(() => {
      timeInputRef.current?.focus();
      reopeningKeyboardRef.current = false;

      const currentHeight = readCurrentHeight();
      if (currentHeight > 0) {
        applySheetLift(currentHeight);
        scrollToTimeField();
      }
    }, 60);
  }, [applySheetLift, keyboardHeight, readCurrentHeight, scrollToTimeField]);

  const handleTimeInputPress = useCallback(() => {
    if (keyboardHeight === 0) {
      focusTimeField();
    }
  }, [focusTimeField, keyboardHeight]);

  useEffect(() => {
    const liftHeight = focusedField === "time" ? keyboardHeight : 0;
    applySheetLift(liftHeight);

    if (liftHeight > 0) {
      scrollToTimeField();
    }
  }, [applySheetLift, focusedField, keyboardHeight, scrollToTimeField]);

  const finishClose = () => {
    setMounted(false);
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdropOpacity.value = withTiming(1, {
        duration: 240,
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
      duration: 200,
      easing: Easing.in(Easing.cubic),
    });
    sheetTranslateY.value = withTiming(
      SHEET_OFFSET,
      {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        }
      }
    );
  }, [backdropOpacity, mounted, sheetTranslateY, visible]);

  useEffect(() => {
    if (!visible) return;

    reset(getDefaultFormValues());
    setFocusedField(null);
    sheetKeyboardLift.value = 0;
    Keyboard.dismiss();
  }, [reset, sheetKeyboardLift, visible]);

  const handleTitleFocus = () => {
    setFocusedField("title");
  };

  const handleTimeFocus = () => {
    if (reopeningKeyboardRef.current) return;
    setFocusedField("time");

    const currentHeight = readCurrentHeight();
    if (currentHeight > 0) {
      applySheetLift(currentHeight);
      scrollToTimeField();
    }
  };

  useEffect(() => {
    setValue("time", clampTimeToPeriod(getValues("time"), period), {
      shouldValidate: true,
    });
  }, [getValues, period, setValue]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
    marginBottom: sheetKeyboardLift.value,
  }));

  const closeModal = () => {
    if (submitting) return;
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);

    try {
      let shouldNotify = values.notify;
      if (shouldNotify) {
        const granted = await requestNotificationPermissions();
        shouldNotify = granted;
      }

      await onSubmit({
        title: values.title,
        date,
        period: values.period,
        notifyAt: shouldNotify ? normalizeTimeInput(values.time) : null,
        googleCalendarSync:
          shouldNotify && googleConnected ? values.googleCalendarSync : false,
        googleReminderMinutes:
          shouldNotify && googleConnected && values.googleCalendarSync
            ? values.googleReminderMinutes
            : null,
      });

      if (shouldNotify && googleConnected) {
        await settingsStorage.setGoogleCalendarSyncEnabled(values.googleCalendarSync);
        await settingsStorage.setGoogleCalendarReminderMinutes(
          values.googleReminderMinutes
        );
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  });

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
            styles.sheetWrap,
            sheetStyle,
          ]}
        >
          <View
            style={[
              styles.sheet,
              {
                paddingBottom:
                  24 + (keyboardHeight > 0 ? 0 : bottomInset),
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Nova tarefa</Text>
              <Pressable
                onPress={closeModal}
                hitSlop={12}
                style={styles.closeButton}
              >
                <X size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.content}>
                <View style={styles.field}>
                  <Text style={styles.label}>O que você precisa fazer?</Text>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        ref={titleInputRef}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        onFocus={handleTitleFocus}
                        placeholder="Ex.: Levar o cachorro para passear"
                        placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        autoFocus={visible}
                        returnKeyType="done"
                      />
                    )}
                  />
                  {errors.title ? (
                    <Text style={styles.errorText}>{errors.title.message}</Text>
                  ) : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Prazo — período do dia</Text>
                  <Controller
                    control={control}
                    name="period"
                    render={({ field: { onChange, value } }) => (
                      <PeriodPicker
                        value={value}
                        onChange={onChange}
                        onBeforeChange={dismissFormKeyboard}
                      />
                    )}
                  />
                </View>

                <View
                  onLayout={(event) => {
                    timeFieldOffsetRef.current = event.nativeEvent.layout.y;
                  }}
                >
                  <Controller
                    control={control}
                    name="time"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TaskTimePicker
                        ref={timeInputRef}
                        value={value}
                        period={period}
                        onChange={onChange}
                        onBlur={onBlur}
                        onFocus={handleTimeFocus}
                        onZonePress={focusTimeField}
                        onInputPress={handleTimeInputPress}
                        error={errors.time?.message}
                      />
                    )}
                  />
                </View>

                <View style={styles.notifyRow}>
                  <Pressable
                    onPress={dismissFormKeyboard}
                    style={styles.notifyContent}
                  >
                    <View style={styles.notifyIcon}>
                      <Bell size={18} color={colors.text} />
                    </View>
                    <View style={styles.notifyText}>
                      <Text style={styles.notifyTitle}>Notificar</Text>
                      <Text style={styles.notifySubtitle}>
                        Receber lembrete nesse horário
                      </Text>
                    </View>
                  </Pressable>
                  <Controller
                    control={control}
                    name="notify"
                    render={({ field: { onChange, value } }) => (
                      <Switch
                        value={value}
                        onValueChange={onChange}
                        trackColor={{
                          false: colors.border,
                          true: colors.primary,
                        }}
                        thumbColor={colors.onPrimary}
                      />
                    )}
                  />
                </View>

                {showGoogleOptions ? (
                  <View style={styles.googleSection}>
                    <View style={styles.notifyRow}>
                      <Pressable
                        onPress={dismissFormKeyboard}
                        style={styles.notifyContent}
                      >
                        <View style={styles.notifyIcon}>
                          <CalendarSync size={18} color={colors.text} />
                        </View>
                        <View style={styles.notifyText}>
                          <Text style={styles.notifyTitle}>Google Agenda</Text>
                          <Text style={styles.notifySubtitle}>
                            Criar evento com lembrete no Calendar
                          </Text>
                        </View>
                      </Pressable>
                      <Controller
                        control={control}
                        name="googleCalendarSync"
                        render={({ field: { onChange, value } }) => (
                          <Switch
                            value={value}
                            onValueChange={onChange}
                            trackColor={{
                              false: colors.border,
                              true: colors.primary,
                            }}
                            thumbColor={colors.onPrimary}
                          />
                        )}
                      />
                    </View>

                    {googleCalendarSyncEnabled ? (
                      <View style={styles.reminderField}>
                        <Text style={styles.label}>
                          Lembrete no Google Calendar
                        </Text>
                        <Controller
                          control={control}
                          name="googleReminderMinutes"
                          render={({ field: { onChange, value } }) => (
                            <GoogleReminderPicker
                              value={value}
                              onChange={onChange}
                              onBeforeChange={dismissFormKeyboard}
                            />
                          )}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <Pressable
                  onPress={() => void submit()}
                  disabled={!isValid || submitting}
                  style={[
                    styles.submitButton,
                    (!isValid || submitting) && styles.submitButtonDisabled,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.submitText}>Adicionar à agenda</Text>
                  )}
                </Pressable>

                <KeyboardSafeArea
                  inset={
                    focusedField === "time"
                      ? Math.round(keyboardHeight * 0.35)
                      : keyboardHeight
                  }
                  extra={
                    KEYBOARD_SAFE_EXTRA + (keyboardHeight > 0 ? 0 : bottomInset)
                  }
                />
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
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
    sheetWrap: {
      maxHeight: "92%",
      width: "100%",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 20,
      paddingHorizontal: 20,
      maxHeight: "100%",
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
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      gap: 18,
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
    notifyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingRight: 16,
      paddingVertical: 14,
      backgroundColor: colors.card,
    },
    notifyContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingLeft: 16,
    },
    notifyIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.backgroundElement,
    },
    notifyText: {
      flex: 1,
      gap: 2,
    },
    notifyTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    notifySubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    googleSection: {
      gap: 12,
    },
    reminderField: {
      gap: 10,
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
    submitText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.onPrimary,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: -8,
    },
  });
