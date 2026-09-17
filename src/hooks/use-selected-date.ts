import { useCallback, useState } from "react";

import { formatDateKey } from "@/database/repositories/tasks.repository";
import { addMonths, startOfMonth } from "@/utils/date";

export function useSelectedDate() {
  const [selectedDate, setSelectedDateState] = useState(() => new Date());
  // O mês exibido no calendário mora aqui, e não dentro dele, porque a tela
  // precisa saber qual mês consultar para os marcadores.
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date())
  );

  const selectedDateKey = formatDateKey(selectedDate);

  const setSelectedDate = useCallback((date: Date) => {
    setSelectedDateState(date);

    // Só troca quando o mês muda de verdade: um `Date` novo a cada toque
    // invalidaria a grade e a consulta de marcadores sem necessidade.
    setVisibleMonth((current) =>
      current.getFullYear() === date.getFullYear() &&
      current.getMonth() === date.getMonth()
        ? current
        : startOfMonth(date)
    );
  }, []);

  const goToPreviousMonth = useCallback(() => {
    setVisibleMonth((current) => addMonths(current, -1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setVisibleMonth((current) => addMonths(current, 1));
  }, []);

  return {
    selectedDate,
    selectedDateKey,
    setSelectedDate,
    visibleMonth,
    goToPreviousMonth,
    goToNextMonth,
  };
}
