import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listPendingTaskDates } from "@/database/repositories/tasks.repository";
import { getMonthRange } from "@/utils/date";

/**
 * Dias do mês exibido que têm tarefa pendente.
 *
 * Só pendente: um ponto em todo dia que já teve tarefa acabaria marcando o mês
 * inteiro e não lembraria nada. Dia resolvido perde o ponto.
 *
 * Não tem `loading` de propósito — marcador não justifica spinner, ele aparece
 * quando a consulta responde. E o efeito depende da chave do mês, não do
 * objeto `Date`: uma data nova a cada render dispararia uma consulta por render.
 */
export function useTaskMarkers(month: Date) {
  const [dates, setDates] = useState<string[]>([]);
  const loadIdRef = useRef(0);

  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  const { start, end } = useMemo(
    () => getMonthRange(month),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthKey]
  );

  const refresh = useCallback(async () => {
    const loadId = ++loadIdRef.current;

    try {
      const result = await listPendingTaskDates(start, end);
      if (loadId !== loadIdRef.current) return;

      // Guardar o array anterior quando o conteúdo é o mesmo — o caso comum ao
      // criar a segunda tarefa de um dia que já tinha uma. Sem isto, cada
      // escrita produz um `Set` novo, a prop do calendário muda e as 42 células
      // da grade são reconstruídas para desenhar exatamente o que já estava
      // lá. As datas vêm ordenadas pelo `GROUP BY`, então comparar posição a
      // posição basta.
      setDates((current) =>
        current.length === result.length &&
        current.every((date, index) => date === result[index])
          ? current
          : result
      );
    } catch {
      // O calendário continua utilizável sem os pontos: falhar aqui não pode
      // virar erro na tela, que já mostra o erro da lista do dia.
      if (loadId === loadIdRef.current) {
        setDates([]);
      }
    }
  }, [end, start]);

  useEffect(() => {
    void refresh();

    return () => {
      loadIdRef.current += 1;
    };
  }, [refresh]);

  const markers = useMemo(() => new Set(dates), [dates]);

  return { markers, refresh };
}
