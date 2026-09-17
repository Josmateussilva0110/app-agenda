import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { useTheme } from "@/context/theme.context";
import {
  addMonths,
  formatMonthYear,
  getCalendarDays,
  isSameDay,
  isToday,
  WEEKDAYS_SHORT,
} from "@/utils/date";

type AgendaCalendarProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
};

export function AgendaCalendar({
  selectedDate,
  onSelectDate,
}: AgendaCalendarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  useEffect(() => {
    // Só troca quando o mês muda de verdade. Antes, qualquer toque em dia criava
    // um `Date` novo, invalidava o `useMemo` da grade e remontava as 42 células
    // para mostrar exatamente o mesmo mês.
    setVisibleMonth((current) =>
      current.getFullYear() === selectedDate.getFullYear() &&
      current.getMonth() === selectedDate.getMonth()
        ? current
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    );
  }, [selectedDate]);

  const month = visibleMonth;
  const days = useMemo(() => getCalendarDays(month), [month]);

  const goToPreviousMonth = () => {
    setVisibleMonth(addMonths(month, -1));
  };

  const goToNextMonth = () => {
    setVisibleMonth(addMonths(month, 1));
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.monthLabel}>{formatMonthYear(month)}</Text>
        <View style={styles.nav}>
          <Pressable onPress={goToPreviousMonth} style={styles.navButton}>
            <ChevronLeft size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={goToNextMonth} style={styles.navButton}>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAYS_SHORT.map((weekday, index) => (
          <Text key={`${weekday}-${index}`} style={styles.weekday}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day, index) => {
          if (!day) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const selected = isSameDay(day, selectedDate);
          const today = isToday(day);
          const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

          return (
            <Pressable
              key={dateKey}
              onPress={() => onSelectDate(day)}
              style={styles.dayCell}
            >
              <View
                style={[
                  styles.dayBadge,
                  selected && styles.dayBadgeSelected,
                  !selected && today && styles.dayBadgeToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    selected && styles.dayTextSelected,
                  ]}
                >
                  {day.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    monthLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    nav: {
      flexDirection: "row",
      gap: 4,
    },
    navButton: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.backgroundElement,
    },
    weekdays: {
      flexDirection: "row",
      marginBottom: 8,
    },
    weekday: {
      flex: 1,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    dayCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 2,
    },
    dayBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    dayBadgeSelected: {
      backgroundColor: colors.calendarSelected,
    },
    dayBadgeToday: {
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    dayTextSelected: {
      color: colors.calendarSelectedText,
    },
  });
