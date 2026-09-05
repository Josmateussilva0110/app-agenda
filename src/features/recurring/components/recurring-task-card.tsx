import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Moon, Sun, Sunrise } from "lucide-react-native";

import { useTheme } from "@/context/theme.context";
import type { RecurringTask } from "@/types/recurring-task";
import type { TaskPeriod } from "@/types/task";
import { parseTime, periodFromHour } from "@/utils/task-time";

const PERIOD_ICONS: Record<TaskPeriod, typeof Sunrise> = {
  manha: Sunrise,
  tarde: Sun,
  noite: Moon,
};

type RecurringTaskCardProps = {
  recurringTask: RecurringTask;
  extraCount?: number;
  onPress: () => void;
};

export function RecurringTaskCard({
  recurringTask,
  extraCount = 0,
  onPress,
}: RecurringTaskCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const inactive = !recurringTask.active;
  const period = periodFromHour(parseTime(recurringTask.time).hour);
  const Icon = PERIOD_ICONS[period];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        inactive && styles.cardInactive,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${recurringTask.title}, às ${recurringTask.time}`}
    >
      {extraCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>+{extraCount}</Text>
        </View>
      ) : null}

      <View style={[styles.iconWrap, inactive && styles.iconWrapInactive]}>
        <Icon size={12} color={inactive ? colors.textMuted : colors.primary} />
      </View>

      <Text
        style={[styles.title, inactive && styles.textInactive]}
        numberOfLines={2}
      >
        {recurringTask.title}
      </Text>
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    card: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 8,
      gap: 4,
      justifyContent: "center",
    },
    cardInactive: {
      backgroundColor: colors.backgroundElement,
      borderStyle: "dashed",
    },
    cardPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.96 }],
    },
    iconWrap: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryMuted,
    },
    iconWrapInactive: {
      backgroundColor: colors.backgroundElement,
    },
    title: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.text,
      lineHeight: 14,
    },
    textInactive: {
      color: colors.textMuted,
    },
    badge: {
      position: "absolute",
      top: 4,
      right: 4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      zIndex: 1,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: "800",
      color: colors.onPrimary,
    },
  });
