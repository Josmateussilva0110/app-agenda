import type { GoogleCalendarEvent } from "@/services/google-calendar/types";
import { GoogleCalendarApiError } from "@/services/google-calendar/api-errors";
import {
  googleCalendarEventSchema,
  googleCalendarEventsResponseSchema,
  parseGoogleCalendarEvents,
} from "@/services/google-calendar/schemas";

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

    const raw = await calendarRequest<unknown>(
      `/calendars/primary/events?${params.toString()}`,
      accessToken
    );

    const response = googleCalendarEventsResponseSchema.safeParse(raw);
    if (!response.success) {
      throw new GoogleCalendarApiError(
        200,
        "Resposta do Google Agenda em formato inesperado."
      );
    }

    const { events: pageEvents, discarded } = parseGoogleCalendarEvents(
      response.data.items ?? []
    );

    if (discarded > 0 && __DEV__) {
      console.warn(
        `[google-calendar] ${discarded} evento(s) fora do formato esperado, ignorados.`
      );
    }

    events.push(...pageEvents);
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return events;
}

/**
 * O evento devolvido pela escrita passa pelo mesmo schema da leitura: é daqui
 * que sai o `id` gravado em `tasks.google_event_id`, e um `id` que não seja
 * string quebraria longe da origem, na próxima gravação ou na próxima URL.
 */
function parseWrittenEvent(raw: unknown): GoogleCalendarEvent {
  const parsed = googleCalendarEventSchema.safeParse(raw);

  if (!parsed.success) {
    throw new GoogleCalendarApiError(
      200,
      "Resposta do Google Agenda em formato inesperado."
    );
  }

  return parsed.data;
}

export async function createPrimaryCalendarEvent(
  accessToken: string,
  event: Record<string, unknown>
): Promise<GoogleCalendarEvent> {
  const raw = await calendarRequest<unknown>(
    "/calendars/primary/events",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(event),
    }
  );

  return parseWrittenEvent(raw);
}

export async function updatePrimaryCalendarEvent(
  accessToken: string,
  eventId: string,
  event: Record<string, unknown>
): Promise<GoogleCalendarEvent> {
  const raw = await calendarRequest<unknown>(
    `/calendars/primary/events/${encodeURIComponent(eventId)}`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify(event),
    }
  );

  return parseWrittenEvent(raw);
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
