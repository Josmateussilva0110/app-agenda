import { z } from "zod";

/**
 * O que o app aceita de um evento do Google.
 *
 * Não existe servidor do projeto para revalidar, então esta é a única fronteira
 * entre o JSON de terceiro e o banco local: `as GoogleCalendarEvent` era uma
 * promessa que ninguém verificava, e um evento sem `start` quebrava a
 * importação inteira com `TypeError` longe da origem.
 */
const eventDateSchema = z.object({
  date: z.string().optional(),
  dateTime: z.string().optional(),
  timeZone: z.string().optional(),
});

export const googleCalendarEventSchema = z.object({
  id: z.string().min(1),
  status: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  start: eventDateSchema,
  end: eventDateSchema.optional().default({}),
});

export const googleCalendarEventsResponseSchema = z.object({
  // Item malformado é descartado sozinho: uma agenda com um evento estranho
  // continua sincronizando os outros.
  items: z.array(z.unknown()).optional(),
  nextPageToken: z.string().optional(),
});

export function parseGoogleCalendarEvents(items: unknown[]): {
  events: z.infer<typeof googleCalendarEventSchema>[];
  discarded: number;
} {
  const events: z.infer<typeof googleCalendarEventSchema>[] = [];
  let discarded = 0;

  for (const item of items) {
    const parsed = googleCalendarEventSchema.safeParse(item);
    if (parsed.success) {
      events.push(parsed.data);
    } else {
      discarded += 1;
    }
  }

  return { events, discarded };
}
