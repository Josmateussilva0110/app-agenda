export class GoogleCalendarApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string
  ) {
    super(`Google Calendar API error (${status})`);
    this.name = "GoogleCalendarApiError";
  }
}

export function toGoogleCalendarUserMessage(
  error: unknown,
  fallback = "Não foi possível comunicar com o Google Agenda."
): string {
  if (error instanceof GoogleCalendarApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Sessão Google expirada. Conecte sua conta novamente.";
    }

    if (error.status === 404) {
      return "Evento não encontrado no Google Agenda.";
    }

    if (error.status === 429) {
      return "Muitas solicitações ao Google Agenda. Tente novamente em instantes.";
    }

    if (error.status >= 500) {
      return "Google Agenda indisponível no momento. Tente novamente mais tarde.";
    }

    return fallback;
  }

  if (error instanceof Error) {
    const message = error.message.trim();

    if (
      message.startsWith("{") ||
      message.startsWith("[") ||
      message.includes("<!DOCTYPE")
    ) {
      return fallback;
    }

    if (message.length > 160) {
      return fallback;
    }

    if (message.includes("invalid_grant") || message.includes("Token has been expired")) {
      return "Sessão Google expirada. Conecte sua conta novamente.";
    }

    return message;
  }

  return fallback;
}
