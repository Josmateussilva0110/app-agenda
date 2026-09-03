import { useCallback, useState } from "react";

import { formatDateKey } from "@/database/repositories/tasks.repository";

export function useSelectedDate() {
  const [selectedDate, setSelectedDateState] = useState(() => new Date());

  const selectedDateKey = formatDateKey(selectedDate);

  const setSelectedDate = useCallback((date: Date) => {
    setSelectedDateState(date);
  }, []);

  return {
    selectedDate,
    selectedDateKey,
    setSelectedDate,
  };
}
