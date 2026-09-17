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
import { toUserMessage } from "@/utils/error-message";
import type { GoogleAccountProfile } from "@/services/google-calendar/types";

const TOKEN_STORAGE_KEY = "google_calendar_tokens";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

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
    // Sem acesso offline: ele só serve para obter um `serverAuthCode`, que se
    // troca por refresh token num backend. Não há backend aqui, o app nunca lê
    // esse código, e pedi-lo amplia o que o usuário consente sem contrapartida.
    offlineAccess: false,
    scopes: GOOGLE_CALENDAR_SCOPES,
  });

  configured = true;
}

function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt - TOKEN_EXPIRY_BUFFER_MS;
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

async function refreshAccessToken(): Promise<string | null> {
  if (!GoogleSignin.hasPreviousSignIn()) {
    return null;
  }

  await GoogleSignin.signInSilently();
  const tokens = await GoogleSignin.getTokens();

  await writeStoredTokens({
    accessToken: tokens.accessToken,
    expiresAt: Date.now() + 55 * 60 * 1000,
  });

  return tokens.accessToken;
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
        // Fora dos códigos conhecidos, a mensagem é texto do SDK escrito para
        // quem desenvolve — não vai para a tela em produção.
        return toUserMessage(error, "Não foi possível conectar ao Google Agenda.");
    }
  }

  if (error instanceof Error) {
    return toUserMessage(error, "Não foi possível conectar ao Google Agenda.");
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

  const cached = await readStoredTokens();
  if (cached && !isTokenExpired(cached.expiresAt)) {
    return cached.accessToken;
  }

  try {
    return await refreshAccessToken();
  } catch {
    if (cached && !isTokenExpired(cached.expiresAt)) {
      return cached.accessToken;
    }

    return null;
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
    // Revogar antes de sair. Só o `signOut` apaga a sessão local e deixa a
    // concessão de `calendar.events` viva na conta: quem pegasse o aparelho
    // reconectaria sem tela de consentimento e leria a agenda do usuário.
    await GoogleSignin.revokeAccess();
  } catch {
    // Sem rede não dá para revogar agora; o token local some de qualquer forma.
  }

  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignora falha ao encerrar sessão nativa.
  }

  await writeStoredTokens(null);
}
