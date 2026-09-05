import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Plus } from "lucide-react-native";

import { premiumFabShadow } from "@/constants/elevation";
import { useTheme } from "@/context/theme.context";

type AgendaFabProps = {
  onPress: () => void;
  bottomOffset?: number;
};

export function AgendaFab({ onPress, bottomOffset = 12 }: AgendaFabProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, bottomOffset),
    [bottomOffset, colors]
  );

  return (
    <View style={[styles.wrap, premiumFabShadow(isDark)]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Plus size={28} color={colors.fabIcon} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useTheme>["colors"],
  bottomOffset: number
) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      right: 20,
      bottom: bottomOffset,
    },
    button: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.fabBackground,
    },
    buttonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.94 }],
    },
  });
