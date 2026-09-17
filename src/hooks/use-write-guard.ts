import { useCallback, useState } from "react";

type WriteAction<T> = () => Promise<T>;

/**
 * Canal único de erro dos hooks de domínio.
 *
 * `guard` existe para que a escrita que falha não mexa no estado local: a ação
 * só chega ao `refresh` se tiver ido até o fim, e o motivo vira mensagem para a
 * tela em vez de exceção solta na árvore de componentes.
 */
export function useWriteGuard() {
  const [error, setError] = useState<string | null>(null);

  const guard = useCallback(
    async <T>(action: WriteAction<T>, fallbackMessage: string): Promise<T | null> => {
      setError(null);

      try {
        return await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : fallbackMessage);
        return null;
      }
    },
    []
  );

  return { error, setError, guard };
}
