import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { premiumFabShadow } from "@/constants/elevation";
import { useTheme } from "@/context/theme.context";

type AgendaFabProps = {
  onPress: () => void;
};

export function AgendaFab({ onPress }: AgendaFabProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(colors, Math.max(insets.bottom, 12)),
    [colors, insets.bottom]
  );

  return (
    <View style={[styles.wrap, premiumFabShadow(isDark)]}>
      <Pressable onPress={onPress} style={styles.button}>
        <Plus size={28} color={colors.fabIcon} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useTheme>["colors"],
  bottomInset: number
) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 16 + bottomInset,
      alignItems: "center",
    },
    button: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.fabBackground,
    },
  });
