import { useEffect, useMemo } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Platform, StatusBar } from "react-native";
import * as NavigationBar from "expo-navigation-bar";

import { Colors } from "@/constants/theme";
import { settingsStorage } from "@/storage/settings.storage";

export const THEME_MODES = ["light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export type ThemeColors = (typeof Colors)[ThemeMode];

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  isLoading: boolean;
  setTheme: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): ThemeMode {
  return settingsStorage.getTheme() ?? "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(resolveInitialTheme);
  const [isLoading] = useState(false);

  const setTheme = useCallback(async (newMode: ThemeMode) => {
    setMode(newMode);
    await settingsStorage.setTheme(newMode);
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = mode === "light" ? "dark" : "light";
    await setTheme(nextMode);
  }, [mode, setTheme]);

  const colors = Colors[mode];

  useEffect(() => {
    if (Platform.OS !== "android") return;

    void NavigationBar.setBackgroundColorAsync(colors.card);
    void NavigationBar.setButtonStyleAsync(mode === "dark" ? "light" : "dark");
  }, [colors.card, mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors,
      isDark: mode === "dark",
      isLoading,
      setTheme,
      toggleTheme,
    }),
    [colors, isLoading, mode, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={colors.statusBarStyle}
        backgroundColor={colors.background}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider.");
  }

  return context;
}
