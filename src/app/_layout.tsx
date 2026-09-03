import "react-native-gesture-handler";
import "react-native-reanimated";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { AppErrorBoundary } from "@/components/app-error-boundary";
import { ThemeProvider } from "@/context/theme.context";
import { DatabaseProvider } from "@/providers/database-provider";
import { initializeNotifications } from "@/services/notifications/task-notifications.service";
import { SafeAreaProvider } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    const hideSplash = () => {
      void SplashScreen.hideAsync().catch(() => {});
    };

    hideSplash();
    const timeout = setTimeout(hideSplash, 1000);

    if (Platform.OS !== "web") {
      void initializeNotifications();
    }

    return () => clearTimeout(timeout);
  }, []);

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <DatabaseProvider>
          <ThemeProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </DatabaseProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
