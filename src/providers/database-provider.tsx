import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Colors } from "@/constants/theme";
import { getDatabase } from "@/database/client";
import { hydrateSettingsCache } from "@/storage/settings.storage";

type DatabaseContextValue = {
  ready: boolean;
};

const DatabaseContext = createContext<DatabaseContextValue>({ ready: false });

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        await getDatabase();
        await hydrateSettingsCache();
      } catch (err) {
        console.error("[database] Falha ao iniciar:", err);
      } finally {
        if (mounted) setReady(true);
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={{ ready }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabaseReady(): boolean {
  return useContext(DatabaseContext).ready;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.background,
  },
});
