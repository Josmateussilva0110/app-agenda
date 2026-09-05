import { useMemo } from "react";
import { CalendarPlus, Clock } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { useTheme } from "@/context/theme.context";
import { RecurringTaskCard } from "@/features/recurring/components/recurring-task-card";
import { buildRecurringMatrix } from "@/features/recurring/utils/build-recurring-matrix";
import {
  WEEKDAY_DISPLAY_ORDER,
  WEEKDAY_SHORT_LABELS,
  type RecurringTask,
  type Weekday,
} from "@/types/recurring-task";

type RecurringMatrixProps = {
  recurringTasks: RecurringTask[];
  onPressTask: (task: RecurringTask) => void;
};

function useMatrixMetrics() {
  const { width } = useWindowDimensions();
  const isCompact = width < 360;

  return useMemo(() => {
    const timeColumnWidth = isCompact ? 42 : 50;
    const gridWidth = width - 40 - 24 - timeColumnWidth;
    const dayColumnWidth = Math.round(
      Math.min(104, Math.max(74, gridWidth / 3))
    );

    return {
      timeColumnWidth,
      dayColumnWidth,
      rowHeight: isCompact ? 58 : 66,
      headerHeight: isCompact ? 34 : 38,
    };
  }, [isCompact, width]);
}

export function RecurringMatrix({ recurringTasks, onPressTask }: RecurringMatrixProps) {
  const { colors } = useTheme();
  const metrics = useMatrixMetrics();
  const styles = useMemo(() => createStyles(colors, metrics), [colors, metrics]);
  const todayWeekday = new Date().getDay() as Weekday;

  const { times, cellsByDayAndTime } = useMemo(
    () => buildRecurringMatrix(recurringTasks),
    [recurringTasks]
  );

  if (times.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <CalendarPlus size={30} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Nenhuma rotina cadastrada</Text>
        <Text style={styles.emptyText}>
          Toque no botão + para adicionar sua primeira atividade recorrente.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.verticalScroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.verticalContent}
    >
      <View style={styles.matrixRow}>
        <View style={styles.timeColumn}>
          <View style={styles.cornerCell}>
            <Clock size={13} color={colors.textMuted} />
          </View>
          {times.map((time, index) => (
            <View key={time} style={styles.timeCell}>
              <Text
                style={[
                  styles.timeText,
                  index % 2 === 0 && styles.timeTextEven,
                ]}
              >
                {time}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.daysRow}>
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
                      {WEEKDAY_SHORT_LABELS[day]}
                    </Text>
                  </View>

                  {times.map((time, index) => {
                    const tasks = cellsByDayAndTime.get(`${day}-${time}`) ?? [];
                    const [primary, ...rest] = tasks;
                    const isEven = index % 2 === 0;

                    return (
                      <View
                        key={time}
                        style={[styles.cell, isEven && styles.cellEven]}
                      >
                        {primary ? (
                          <RecurringTaskCard
                            recurringTask={primary}
                            extraCount={rest.length}
                            onPress={() => onPressTask(primary)}
                          />
                        ) : (
                          <View style={styles.emptyCell} />
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}

type MatrixMetrics = ReturnType<typeof useMatrixMetrics>;

const createStyles = (
  colors: ReturnType<typeof useTheme>["colors"],
  metrics: MatrixMetrics
) =>
  StyleSheet.create({
    verticalScroll: {
      flex: 1,
    },
    verticalContent: {
      paddingBottom: 8,
    },
    matrixRow: {
      flexDirection: "row",
    },
    timeColumn: {
      width: metrics.timeColumnWidth,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      marginRight: 10,
    },
    cornerCell: {
      height: metrics.headerHeight,
      marginBottom: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    timeCell: {
      height: metrics.rowHeight,
      alignItems: "center",
      justifyContent: "center",
      paddingRight: 8,
    },
    timeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
    },
    timeTextEven: {
      color: colors.textSecondary,
    },
    daysRow: {
      flexDirection: "row",
    },
    dayColumn: {
      width: metrics.dayColumnWidth,
      paddingLeft: 6,
    },
    dayHeaderCell: {
      height: metrics.headerHeight,
      marginBottom: 8,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.backgroundElement,
    },
    dayHeaderCellToday: {
      backgroundColor: colors.primary,
    },
    dayHeaderText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.text,
    },
    dayHeaderTextToday: {
      color: colors.onPrimary,
    },
    cell: {
      height: metrics.rowHeight,
      paddingVertical: 3,
      paddingRight: 2,
    },
    cellEven: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
    },
    emptyCell: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.emptyBorder,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 32,
    },
    emptyIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryMuted,
      marginBottom: 6,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 18,
    },
  });
