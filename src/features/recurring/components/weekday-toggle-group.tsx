import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/context/theme.context";
import {
  WEEKDAY_DISPLAY_ORDER,
  WEEKDAY_INITIALS,
  WEEKDAY_LABELS,
  type Weekday,
} from "@/types/recurring-task";

type WeekdayToggleGroupProps = {
  value: Weekday[];
  onChange: (value: Weekday[]) => void;
};

export function WeekdayToggleGroup({ value, onChange }: WeekdayToggleGroupProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const toggle = (day: Weekday) => {
    if (value.includes(day)) {
      onChange(value.filter((selected) => selected !== day));
      return;
    }

    onChange([...value, day].sort((a, b) => a - b));
  };

  return (
    <View style={styles.row}>
      {WEEKDAY_DISPLAY_ORDER.map((day) => {
        const selected = value.includes(day);

        return (
          <Pressable
            key={day}
            onPress={() => toggle(day)}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={WEEKDAY_LABELS[day]}
            hitSlop={4}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {WEEKDAY_INITIALS[day]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 6,
    },
    chip: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    chipTextSelected: {
      color: colors.onPrimary,
    },
  });
