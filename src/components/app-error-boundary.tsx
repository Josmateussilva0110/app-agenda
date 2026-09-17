import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (__DEV__) {
      console.error("[app] Erro não tratado:", error, info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Algo deu errado</Text>
          {/* Mensagem de exceção é detalhe interno: em produção o usuário
              recebe uma orientação, não o texto do erro. */}
          <Text style={styles.message}>
            {__DEV__
              ? this.state.error.message
              : "Feche e abra o app novamente. Se continuar, reinstale a última versão."}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Esta tela roda acima do ThemeProvider, então não há hook de tema para ler:
// a paleta clara é fixada aqui de propósito.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
});
