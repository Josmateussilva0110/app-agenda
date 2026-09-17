import { Platform, type ViewStyle } from "react-native";

import { Colors } from "@/constants/theme";

export function premiumFabShadow(isDark: boolean): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: isDark ? Colors.dark.shadow : Colors.light.shadow,
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
