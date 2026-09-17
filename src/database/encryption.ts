import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const DB_KEY_STORAGE = "database.encryption.key";
const CONVERSION_PENDING_STORAGE = "database.encryption.converting";

export async function getDatabaseEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DB_KEY_STORAGE);
  if (existing) {
    return existing;
  }

  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  await SecureStore.setItemAsync(DB_KEY_STORAGE, key);
  return key;
}

/**
 * Marca que uma conversão de banco está em curso.
 *
 * O sinal mora fora do banco de propósito: a janela que ele protege é
 * justamente aquela em que o arquivo principal foi apagado e a cópia cifrada
 * ainda não voltou. Usar "banco vazio" como sinal confundiria conversão
 * interrompida com instalação nova — e a segunda é muito mais frequente.
 */
export async function markConversionPending(): Promise<void> {
  await SecureStore.setItemAsync(CONVERSION_PENDING_STORAGE, "1");
}

export async function clearConversionPending(): Promise<void> {
  await SecureStore.deleteItemAsync(CONVERSION_PENDING_STORAGE);
}

export async function isConversionPending(): Promise<boolean> {
  return (await SecureStore.getItemAsync(CONVERSION_PENDING_STORAGE)) === "1";
}

/**
 * Escapa aspa simples para interpolar em literal SQL. Serve ao `PRAGMA key` e
 * ao caminho do `ATTACH`, que não aceitam parâmetro ligado.
 */
export function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}
