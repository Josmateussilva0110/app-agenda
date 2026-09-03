import { useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/context/theme.context";

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = Math.max(insets.bottom, 16);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingBottom: bottomInset }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={[styles.button, styles.cancelButton]}
            >
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={[
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
                loading && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  color={destructive ? "#FFFFFF" : colors.onPrimary}
                  size="small"
                />
              ) : (
                <Text
                  style={
                    destructive ? styles.destructiveButtonText : styles.confirmButtonText
                  }
                >
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
      backgroundColor: "rgba(15, 23, 42, 0.45)",
    },
    card: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 20,
      gap: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    button: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    cancelButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundElement,
    },
    cancelButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    confirmButton: {
      backgroundColor: colors.primary,
    },
    confirmButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.onPrimary,
    },
    destructiveButton: {
      backgroundColor: colors.danger,
    },
    destructiveButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    buttonDisabled: {
      opacity: 0.7,
    },
  });
