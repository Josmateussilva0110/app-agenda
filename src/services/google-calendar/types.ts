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
};

export type GoogleAccountProfile = {
  name: string | null;
  email: string;
  photoUrl: string | null;
};
