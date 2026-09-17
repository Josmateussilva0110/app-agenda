/**
 * Texto de exceção é detalhe interno: o caminho do arquivo do banco, o estado
 * do SQLite, a frase que o desenvolvedor escreveu para o desenvolvedor. Em
 * produção o usuário recebe a mensagem do app; o original fica para o `__DEV__`,
 * onde ele serve para depurar.
 */
export function toUserMessage(error: unknown, fallback: string): string {
  if (__DEV__ && error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
