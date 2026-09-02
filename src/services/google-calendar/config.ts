import Constants from "expo-constants";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
];

export function getGoogleCalendarConfig() {
  const extra = Constants.expoConfig?.extra as
    | {
        googleWebClientId?: string;
        googleAndroidClientId?: string;
      }
    | undefined;

  const webClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    extra?.googleWebClientId ??
    "";
  const androidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
    extra?.googleAndroidClientId ??
    "";

  return { webClientId, androidClientId };
}

export function isGoogleCalendarConfigured(): boolean {
  const { webClientId } = getGoogleCalendarConfig();
  return webClientId.length > 0;
}
