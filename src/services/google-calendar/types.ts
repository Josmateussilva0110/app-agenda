export type GoogleCalendarEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start: GoogleCalendarEventDate;
  end: GoogleCalendarEventDate;
};

export type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
};

export type GoogleCalendarSyncResult = {
  imported: number;
  exported: number;
  updated: number;
  /** Tarefas que o Google recusou; as demais do lote seguiram normalmente. */
  failed: number;
};

export type GoogleAccountProfile = {
  name: string | null;
  email: string;
  photoUrl: string | null;
};

/** Feriado de um dia, vindo do calendário público de feriados do Google. */
export type Holiday = {
  /** Chave `YYYY-MM-DD`. */
  date: string;
  name: string;
};
