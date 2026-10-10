import { useEffect, useMemo, useState } from "react";

import { googleCalendarService, type Holiday } from "@/services/google-calendar";
import { getMonthRange } from "@/utils/date";

const EMPTY: Holiday[] = [];

/**
 * Feriados do mês exibido, vindos do Google Agenda, por chave `YYYY-MM-DD`.
 *
 * Só busca com a conta conectada; desconectar limpa a marcação. Como em
 * `useTaskMarkers`, não há `loading` nem erro: a marcação aparece quando chega,
 * e falhar só deixa o calendário sem ela.
 */
export function useHolidays(month: Date, connected: boolean) {
  const [holidays, setHolidays] = useState<Holiday[]>(EMPTY);

  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  const { start, end } = useMemo(
    () => getMonthRange(month),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthKey]
  );

  useEffect(() => {
    if (!connected) {
      setHolidays(EMPTY);
      return;
    }

    let active = true;

    void googleCalendarService.listHolidays(start, end).then((result) => {
      if (active) setHolidays(result);
    });

    return () => {
      active = false;
    };
  }, [connected, end, start]);

  // Mais de um feriado no mesmo dia vira um nome só, separado por " · ".
  return useMemo(() => {
    const byDate = new Map<string, string>();
    for (const { date, name } of holidays) {
      const current = byDate.get(date);
      byDate.set(date, current ? `${current} · ${name}` : name);
    }
    return byDate;
  }, [holidays]);
}
