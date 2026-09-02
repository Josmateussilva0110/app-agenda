import { forwardRef, useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Clock } from "lucide-react-native";

import { useTheme } from "@/context/theme.context";
import { PERIOD_DESCRIPTIONS, type TaskPeriod } from "@/types/task";
import { formatTimeInput, normalizeTimeInput } from "@/utils/task-time";

type TaskTimePickerProps = {
  value: string;
  period: TaskPeriod;
  onChange: (time: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onZonePress?: () => void;
  onInputPress?: () => void;
  error?: string;
};

export const TaskTimePicker = forwardRef<TextInput, TaskTimePickerProps>(
  function TaskTimePicker(
    { value, period, onChange, onBlur, onFocus, onZonePress, onInputPress, error },
    ref
  ) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
      <View style={styles.wrap}>
        <View style={[styles.row, error ? styles.rowError : null]}>
          <Pressable
            onPress={onZonePress}
            style={styles.textBlock}
            accessibilityRole="button"
            accessibilityLabel="Editar horário"
          >
            <Text style={styles.title}>Horário</Text>
            <Text style={styles.subtitle}>
              Digite o horário exato ({PERIOD_DESCRIPTIONS[period]})
            </Text>
          </Pressable>

          <View style={styles.inputWrap}>
            <TextInput
              ref={ref}
              value={value}
              onChangeText={(text) => onChange(formatTimeInput(text))}
              onFocus={onFocus}
              onPressIn={onInputPress}
              onBlur={() => {
                onChange(normalizeTimeInput(value));
                onBlur?.();
              }}
              placeholder="09:30"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={5}
              style={styles.input}
              returnKeyType="done"
            />
            <Clock size={16} color={colors.textSecondary} />
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }
);

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    wrap: {
      gap: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.card,
      gap: 12,
    },
    rowError: {
      borderColor: colors.error,
    },
    textBlock: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.backgroundElement,
      minWidth: 108,
    },
    input: {
      minWidth: 56,
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      padding: 0,
      textAlign: "center",
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginLeft: 4,
    },
  });
