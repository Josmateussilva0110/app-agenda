import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { useTheme } from "@/context/theme.context";
import {
  GOOGLE_REMINDER_MINUTES_OPTIONS,
  type GoogleReminderMinutes,
} from "@/constants/google-calendar";

type GoogleReminderPickerProps = {
  value: number;
  onChange: (minutes: GoogleReminderMinutes) => void;
  onBeforeChange?: () => void;
};

export function GoogleReminderPicker({
  value,
  onChange,
  onBeforeChange,
}: GoogleReminderPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {GOOGLE_REMINDER_MINUTES_OPTIONS.map((option) => {
        const selected = value === option.minutes;

        return (
          <Pressable
            key={option.minutes}
            onPress={() => {
              onBeforeChange?.();
              onChange(option.minutes);
            }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 2,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.card,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    labelSelected: {
      color: colors.onPrimary,
    },
  });
