import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Moon, Sun } from "lucide-react-native";

import { useTheme } from "@/context/theme.context";

export function ThemeToggleButton() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={() => void toggleTheme()}
      style={styles.button}
      accessibilityLabel={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      accessibilityRole="button"
    >
      {isDark ? (
        <Sun size={20} color={colors.text} />
      ) : (
        <Moon size={20} color={colors.text} />
      )}
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    button: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundElement,
      alignItems: "center",
      justifyContent: "center",
    },
  });
