import { forwardRef, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Moon, Sun, Sunrise } from "lucide-react-native";

import { Colors } from "@/constants/theme";
import { buildRecurringMatrix } from "@/features/recurring/utils/build-recurring-matrix";
import {
  WEEKDAY_DISPLAY_ORDER,
  WEEKDAY_LABELS,
  type RecurringTask,
  type Weekday,
} from "@/types/recurring-task";
import type { TaskPeriod } from "@/types/task";
import { formatDayMonth } from "@/utils/date";
import { parseTime, periodFromHour } from "@/utils/task-time";

const colors = Colors.light;

const TIME_COLUMN_WIDTH = 64;
const DAY_COLUMN_WIDTH = 128;
const ROW_HEIGHT = 84;
const HEADER_HEIGHT = 48;

const PERIOD_ICONS: Record<TaskPeriod, typeof Sunrise> = {
  manha: Sunrise,
  tarde: Sun,
  noite: Moon,
};

type RecurringMatrixExportViewProps = {
  recurringTasks: RecurringTask[];
};

export const RecurringMatrixExportView = forwardRef<
  View,
  RecurringMatrixExportViewProps
>(function RecurringMatrixExportView({ recurringTasks }, ref) {
  const todayWeekday = new Date().getDay() as Weekday;
  const { times, cellsByDayAndTime } = useMemo(
    () => buildRecurringMatrix(recurringTasks),
    [recurringTasks]
  );

  return (
    <View ref={ref} collapsable={false} style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Rotina Semanal</Text>
        <Text style={styles.subtitle}>
          {formatDayMonth(new Date())} · Minha Agenda
        </Text>
      </View>

      {times.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhuma rotina cadastrada.</Text>
        </View>
      ) : (
        <View style={styles.matrixRow}>
          <View style={styles.timeColumn}>
            <View style={styles.cornerCell} />
            {times.map((time) => (
              <View key={time} style={styles.timeCell}>
                <Text style={styles.timeText}>{time}</Text>
              </View>
            ))}
          </View>

          {WEEKDAY_DISPLAY_ORDER.map((day) => {
            const isToday = day === todayWeekday;

            return (
              <View key={day} style={styles.dayColumn}>
                <View
                  style={[styles.dayHeaderCell, isToday && styles.dayHeaderCellToday]}
                >
                  <Text
                    style={[styles.dayHeaderText, isToday && styles.dayHeaderTextToday]}
                  >
                    {WEEKDAY_LABELS[day]}
                  </Text>
                </View>

                {times.map((time, index) => {
                  const tasks = cellsByDayAndTime.get(`${day}-${time}`) ?? [];
                  const [primary, ...rest] = tasks;
                  const isEven = index % 2 === 0;
                  const Icon = primary
                    ? PERIOD_ICONS[periodFromHour(parseTime(primary.time).hour)]
                    : null;

                  return (
                    <View
                      key={time}
                      style={[styles.cell, isEven && styles.cellEven]}
                    >
                      {primary ? (
                        <View
                          style={[
                            styles.card,
                            !primary.active && styles.cardInactive,
                          ]}
                        >
                          {Icon ? (
                            <Icon
                              size={14}
                              color={
                                primary.active ? colors.primary : colors.textMuted
                              }
                            />
                          ) : null}
                          <Text
                            style={[
                              styles.cardText,
                              !primary.active && styles.cardTextInactive,
                            ]}
                            numberOfLines={2}
                          >
                            {primary.title}
                          </Text>
                          {rest.length > 0 ? (
                            <Text style={styles.cardExtra}>+{rest.length}</Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.footer}>Gerado pelo app Minha Agenda</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.background,
    padding: 24,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 2,
  },
  matrixRow: {
    flexDirection: "row",
  },
  timeColumn: {
    width: TIME_COLUMN_WIDTH,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    marginRight: 10,
  },
  cornerCell: {
    height: HEADER_HEIGHT,
    marginBottom: 8,
  },
  timeCell: {
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 8,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  dayColumn: {
    width: DAY_COLUMN_WIDTH,
    paddingLeft: 6,
  },
  dayHeaderCell: {
    height: HEADER_HEIGHT,
    marginBottom: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundElement,
  },
  dayHeaderCellToday: {
    backgroundColor: colors.primary,
  },
  dayHeaderText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  dayHeaderTextToday: {
    color: colors.onPrimary,
  },
  cell: {
    height: ROW_HEIGHT,
    paddingVertical: 4,
    paddingRight: 2,
  },
  cellEven: {
    backgroundColor: colors.backgroundElement,
    borderRadius: 14,
  },
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
    gap: 4,
    justifyContent: "center",
  },
  cardInactive: {
    backgroundColor: colors.backgroundElement,
    borderStyle: "dashed",
  },
  cardText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 15,
  },
  cardTextInactive: {
    color: colors.textMuted,
  },
  cardExtra: {
    position: "absolute",
    top: 6,
    right: 8,
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: 20,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "right",
  },
});
