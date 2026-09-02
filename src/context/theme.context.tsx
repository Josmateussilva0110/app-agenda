import { useMemo } from "react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { Colors } from "@/constants/theme";
import { settingsStorage } from "@/storage/settings.storage";

export type ThemeMode = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ThemeMode];

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = settingsStorage.getTheme();
    if (saved) setMode(saved);
    setIsLoading(false);
  }, []);

  const setTheme = useCallback(async (newMode: ThemeMode) => {
    setMode(newMode);
    await settingsStorage.setTheme(newMode);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: Colors[mode],
      isDark: mode === "dark",
      setTheme,
      isLoading,
    }),
    [mode, setTheme, isLoading]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return ctx;
}
