import { Platform, type ViewStyle } from "react-native";

export function premiumFabShadow(isDark: boolean): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: isDark ? "#000000" : "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.35 : 0.2,
      shadowRadius: 16,
    },
    android: {
      elevation: 8,
    },
    default: {},
  }) as ViewStyle;
}
