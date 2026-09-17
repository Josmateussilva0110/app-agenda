const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const WEEKDAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

export function formatMonthYear(date: Date): string {
  const month = MONTHS[date.getMonth()];
  const capitalized = month.charAt(0).toUpperCase() + month.slice(1);
  return `${capitalized} de ${date.getFullYear()}`;
}

export function formatDayMonth(date: Date): string {
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${day} de ${month}`;
}

/** "16 set" — para o badge do mural, onde a forma por extenso não cabe. */
export function formatDayMonthShort(date: Date): string {
  const day = date.getDate();
  const month = MONTHS[date.getMonth()].slice(0, 3);
  return `${day} ${month}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function getCalendarDays(month: Date): (Date | null)[] {
  const firstDay = startOfMonth(month);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();

  const cells: (Date | null)[] = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Primeiro e último dia do mês da data, em chave `YYYY-MM-DD`. */
export function getMonthRange(date: Date): { start: string; end: string } {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    start: formatDateKey(startOfMonth(date)),
    end: formatDateKey(lastDay),
  };
}

export function getWeekRange(dateKey: string): { start: string; end: string } {
  const date = parseDateKey(dateKey);
  const weekday = date.getDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: formatDateKey(monday),
    end: formatDateKey(sunday),
  };
}

export function toDayStartIso(dateKey: string): string {
  const date = parseDateKey(dateKey);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function toDayEndIso(dateKey: string): string {
  const date = parseDateKey(dateKey);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export { WEEKDAYS_SHORT };
