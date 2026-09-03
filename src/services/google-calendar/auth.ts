import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";

import {
  getGoogleCalendarConfig,
  GOOGLE_CALENDAR_SCOPES,
} from "@/services/google-calendar/config";
import type { GoogleAccountProfile } from "@/services/google-calendar/types";

const TOKEN_STORAGE_KEY = "google_calendar_tokens";

type StoredTokens = {
  accessToken: string;
  expiresAt: number;
};

let configured = false;

function configureGoogleSignIn() {
  if (configured) return;

  const { webClientId } = getGoogleCalendarConfig();

  GoogleSignin.configure({
    webClientId,
    offlineAccess: true,
    scopes: GOOGLE_CALENDAR_SCOPES,
  });

  configured = true;
}

async function readStoredTokens(): Promise<StoredTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

async function writeStoredTokens(tokens: StoredTokens | null): Promise<void> {
  if (!tokens) {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

function getSignInErrorMessage(error: unknown): string {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return "Autorização com Google cancelada.";
      case statusCodes.IN_PROGRESS:
        return "Login com Google já está em andamento.";
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return "Google Play Services não está disponível neste dispositivo.";
      default:
        return error.message || "Não foi possível conectar ao Google Agenda.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível conectar ao Google Agenda.";
}

export async function connectGoogleAccount(): Promise<void> {
  const { webClientId } = getGoogleCalendarConfig();

  if (!webClientId) {
    throw new Error(
      "Google Agenda não configurado. Defina EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID."
    );
  }

  configureGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      throw new Error("Autorização com Google cancelada.");
    }

    const tokens = await GoogleSignin.getTokens();

    await writeStoredTokens({
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
    });
  } catch (error) {
    throw new Error(getSignInErrorMessage(error));
  }
}

export async function getGoogleAccessToken(): Promise<string | null> {
  configureGoogleSignIn();

  try {
    if (GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signInSilently();
    } else {
      return null;
    }

    const tokens = await GoogleSignin.getTokens();
    await writeStoredTokens({
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
    });

    return tokens.accessToken;
  } catch {
    const cached = await readStoredTokens();
    return cached?.accessToken ?? null;
  }
}

export async function hasGoogleAccountConnected(): Promise<boolean> {
  configureGoogleSignIn();
  return GoogleSignin.hasPreviousSignIn();
}

export function getGoogleAccountProfile(): GoogleAccountProfile | null {
  configureGoogleSignIn();
  const current = GoogleSignin.getCurrentUser();
  if (!current) {
    return null;
  }

  return {
    name: current.user.name,
    email: current.user.email,
    photoUrl: current.user.photo,
  };
}

export async function disconnectGoogleAccount(): Promise<void> {
  configureGoogleSignIn();

  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignora falha ao encerrar sessão nativa.
  }

  await writeStoredTokens(null);
}
