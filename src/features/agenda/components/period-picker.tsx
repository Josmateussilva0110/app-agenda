import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Moon, Sun, Sunrise } from "lucide-react-native";

import { useTheme } from "@/context/theme.context";
import { PERIOD_LABELS, type TaskPeriod } from "@/types/task";

const PERIOD_ICONS: Record<TaskPeriod, typeof Sunrise> = {
  manha: Sunrise,
  tarde: Sun,
  noite: Moon,
};

type PeriodPickerProps = {
  value: TaskPeriod;
  onChange: (period: TaskPeriod) => void;
  onBeforeChange?: () => void;
};

export function PeriodPicker({ value, onChange, onBeforeChange }: PeriodPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {(Object.keys(PERIOD_ICONS) as TaskPeriod[]).map((period) => {
        const Icon = PERIOD_ICONS[period];
        const selected = value === period;

        return (
          <Pressable
            key={period}
            onPress={() => {
              onBeforeChange?.();
              onChange(period);
            }}
            style={[styles.card, selected && styles.cardSelected]}
          >
            <Icon size={18} color={selected ? colors.onPrimary : colors.text} />
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {PERIOD_LABELS[period]}
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
      gap: 10,
    },
    card: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    cardSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    label: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    labelSelected: {
      color: colors.onPrimary,
    },
  });
