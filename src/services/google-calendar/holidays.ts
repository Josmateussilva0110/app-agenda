import { getGoogleAccessToken } from "@/services/google-calendar/auth";
import { listCalendarEvents } from "@/services/google-calendar/calendar-api";
import type {
  GoogleCalendarEvent,
  Holiday,
} from "@/services/google-calendar/types";
import { formatDateKey, parseDateKey, toDayEndIso, toDayStartIso } from "@/utils/date";

/**
 * Calendário público de feriados do Brasil mantido pelo Google. É legível com o
 * escopo `calendar.events` que o app já pede, então não exige novo consentimento.
 */
const BRAZIL_HOLIDAY_CALENDAR_ID =
  "pt-br.brazilian#holiday@group.v.calendar.google.com";

// Feriado não muda de um minuto para o outro: guardar por intervalo evita uma
// ida à rede a cada troca de mês para frente e para trás.
const cache = new Map<string, Holiday[]>();

/**
 * Feriado é evento de dia inteiro (`start.date`), com `end.date` exclusivo.
 * Um evento de vários dias vira um feriado por dia.
 */
function toHolidays(event: GoogleCalendarEvent): Holiday[] {
  const startKey = event.start.date;
  if (!startKey || event.status === "cancelled") {
    return [];
  }

  const name = event.summary?.trim() || "Feriado";
  const endKey = event.end.date ?? startKey;
  const holidays: Holiday[] = [];

  const cursor = parseDateKey(startKey);
  const end = parseDateKey(endKey);

  do {
    holidays.push({ date: formatDateKey(cursor), name });
    cursor.setDate(cursor.getDate() + 1);
  } while (cursor < end);

  return holidays;
}

export async function listHolidays(
  start: string,
  end: string
): Promise<Holiday[]> {
  const cacheKey = `${start}:${end}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return [];
  }

  const events = await listCalendarEvents(
    accessToken,
    BRAZIL_HOLIDAY_CALENDAR_ID,
    toDayStartIso(start),
    toDayEndIso(end)
  );

  const holidays = events
    .flatMap(toHolidays)
    .filter((holiday) => holiday.date >= start && holiday.date <= end);

  cache.set(cacheKey, holidays);
  return holidays;
}

export function clearHolidaysCache(): void {
  cache.clear();
}
