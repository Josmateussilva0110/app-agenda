import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { useTheme } from "@/context/theme.context";
import {
  formatDateKey,
  formatDayMonth,
  formatMonthYear,
  getCalendarDays,
  isSameDay,
  isToday,
  WEEKDAYS_SHORT,
} from "@/utils/date";

type AgendaCalendarProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  visibleMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  /** Dias com tarefa pendente, por chave `YYYY-MM-DD`. */
  markers: Set<string>;
  /** Nome do feriado por chave `YYYY-MM-DD`. */
  holidays: Map<string, string>;
};

function describeDay(
  day: Date,
  hasPending: boolean,
  holiday: string | undefined
): string {
  let label = formatDayMonth(day);
  if (holiday) label += `, feriado: ${holiday}`;
  if (hasPending) label += ", tem tarefa pendente";
  return label;
}

/**
 * Memoizado porque todas as props são estáveis: as três ações são `useCallback`
 * com dependências vazias em `use-selected-date`, `visibleMonth` só ganha
 * objeto novo quando o mês muda de fato, e `markers` mantém a identidade
 * enquanto as datas forem as mesmas. Sem essa estabilidade o memo não seguraria
 * nada — os dois andam juntos.
 */
export const AgendaCalendar = memo(function AgendaCalendar({
  selectedDate,
  onSelectDate,
  visibleMonth,
  onPreviousMonth,
  onNextMonth,
  markers,
  holidays,
}: AgendaCalendarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const month = visibleMonth;
  const days = useMemo(() => getCalendarDays(month), [month]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.monthLabel}>{formatMonthYear(month)}</Text>
        <View style={styles.nav}>
          <Pressable
            onPress={onPreviousMonth}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Mês anterior"
          >
            <ChevronLeft size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={onNextMonth}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Próximo mês"
          >
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAYS_SHORT.map((weekday, index) => (
          <Text
            key={`${weekday}-${index}`}
            style={[styles.weekday, index === 0 && styles.weekdaySunday]}
          >
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
          // Mesma função que gera a chave no banco: o marcador é buscado por
          // ela, então os dois formatos têm que vir do mesmo lugar.
          const dateKey = formatDateKey(day);
          const hasPending = markers.has(dateKey);
          const holiday = holidays.get(dateKey);
          const sunday = day.getDay() === 0;

          return (
            <Pressable
              key={dateKey}
              onPress={() => onSelectDate(day)}
              style={styles.dayCell}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={describeDay(day, hasPending, holiday)}
            >
              <View
                style={[
                  styles.dayBadge,
                  !selected && holiday && styles.dayBadgeHoliday,
                  selected && styles.dayBadgeSelected,
                  !selected && today && styles.dayBadgeToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !selected && sunday && styles.dayTextSunday,
                    !selected && holiday && styles.dayTextHoliday,
                    selected && styles.dayTextSelected,
                  ]}
                >
                  {day.getDate()}
                </Text>

                {hasPending ? (
                  <View
                    style={[
                      styles.marker,
                      selected && styles.markerSelected,
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

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
    // Fundo suave e número na cor de feriado: lê-se de relance, como num
    // calendário de parede, sem competir com o ponto de tarefa pendente.
    dayBadgeHoliday: {
      backgroundColor: colors.calendarHolidayBg,
    },
    // Domingo só ganha a cor do número, sem o fundo: o fundo continua sendo o
    // que distingue feriado, inclusive feriado que cai num domingo.
    weekdaySunday: {
      color: colors.calendarHoliday,
    },
    dayTextSunday: {
      color: colors.calendarHoliday,
    },
    dayTextHoliday: {
      color: colors.calendarHoliday,
      fontWeight: "800",
    },
    dayText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    // O ponto fica dentro do badge: a célula tem ~41px e o badge 34px, então
    // não há espaço útil abaixo dele.
    marker: {
      position: "absolute",
      bottom: 3,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    // `calendarSelected` é a mesma cor de `primary` nos dois temas: sobre o dia
    // selecionado o ponto precisa da cor do texto, senão desaparece no fundo.
    markerSelected: {
      backgroundColor: colors.calendarSelectedText,
    },
    dayTextSelected: {
      color: colors.calendarSelectedText,
    },
  });
