import type {
  GoogleCalendarEvent,
  GoogleCalendarEventsResponse,
} from "@/services/google-calendar/types";
import { GoogleCalendarApiError } from "@/services/google-calendar/api-errors";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

async function calendarRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${CALENDAR_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new GoogleCalendarApiError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listPrimaryCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "100",
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const data = await calendarRequest<GoogleCalendarEventsResponse>(
      `/calendars/primary/events?${params.toString()}`,
      accessToken
    );

    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}

export async function createPrimaryCalendarEvent(
  accessToken: string,
  event: Record<string, unknown>
): Promise<GoogleCalendarEvent> {
  return calendarRequest<GoogleCalendarEvent>(
    "/calendars/primary/events",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(event),
    }
  );
}

export async function updatePrimaryCalendarEvent(
  accessToken: string,
  eventId: string,
  event: Record<string, unknown>
): Promise<GoogleCalendarEvent> {
  return calendarRequest<GoogleCalendarEvent>(
    `/calendars/primary/events/${encodeURIComponent(eventId)}`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify(event),
    }
  );
}

export async function deletePrimaryCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 404 || response.status === 410) {
    return;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new GoogleCalendarApiError(response.status, body);
  }
}
