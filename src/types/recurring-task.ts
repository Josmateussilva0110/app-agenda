export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_DISPLAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

export const WEEKDAY_INITIALS: Record<Weekday, string> = {
  0: "D",
  1: "S",
  2: "T",
  3: "Q",
  4: "Q",
  5: "S",
  6: "S",
};

export type RecurringTask = {
  id: string;
  title: string;
  description: string | null;
  time: string;
  weekdays: Weekday[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateRecurringTaskInput = {
  title: string;
  description?: string | null;
  time: string;
  weekdays: Weekday[];
};

export type UpdateRecurringTaskInput = Partial<CreateRecurringTaskInput> & {
  active?: boolean;
};
