import { useCallback, useEffect, useState } from "react";

import { formatDateKey } from "@/database/repositories/tasks.repository";
import { settingsStorage } from "@/storage/settings.storage";

export function useSelectedDate() {
  const [selectedDate, setSelectedDateState] = useState(() => {
    const stored = settingsStorage.getSelectedDate();
    return stored ? new Date(`${stored}T12:00:00`) : new Date();
  });

  const selectedDateKey = formatDateKey(selectedDate);

  const setSelectedDate = useCallback((date: Date) => {
    setSelectedDateState(date);
    void settingsStorage.setSelectedDate(formatDateKey(date));
  }, []);

  useEffect(() => {
    void settingsStorage.setSelectedDate(selectedDateKey);
  }, [selectedDateKey]);

  return {
    selectedDate,
    selectedDateKey,
    setSelectedDate,
  };
}
