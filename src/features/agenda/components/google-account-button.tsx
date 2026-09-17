import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Unlink, UserRound } from "lucide-react-native";

import { useTheme } from "@/context/theme.context";
import type { GoogleAccountProfile } from "@/services/google-calendar";

type GoogleAccountButtonProps = {
  account: GoogleAccountProfile;
  onDisconnect: () => Promise<void>;
};

type MenuPosition = {
  top: number;
  right: number;
};

/**
 * A foto do Google vem num tamanho fixo (o sufixo `=sNNN-c` da URL) e é
 * decodificada na resolução original, não na que a tela usa. Pedir o tamanho
 * certo é trocar um bitmap grande por um do tamanho do avatar.
 */
function sizedPhotoUrl(photoUrl: string, sizeDp: number): string {
  const sizePx = PixelRatio.getPixelSizeForLayoutSize(sizeDp);
  return photoUrl.replace(/=s\d+(-c)?$/, `=s${sizePx}$1`);
}

export function GoogleAccountButton({
  account,
  onDisconnect,
}: GoogleAccountButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const anchorRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, right: 16 });
  const [disconnecting, setDisconnecting] = useState(false);

  const openMenu = () => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPosition({
        top: y + height + 8,
        right: Math.max(16, windowWidth - x - width),
      });
      setMenuOpen(true);
    });
  };

  const closeMenu = () => {
    if (!disconnecting) {
      setMenuOpen(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);

    try {
      await onDisconnect();
      setMenuOpen(false);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <>
      <Pressable
        ref={anchorRef}
        onPress={openMenu}
        style={styles.button}
        accessibilityLabel="Conta Google conectada"
        accessibilityHint="Toque para abrir o menu da conta"
      >
        {account.photoUrl ? (
          <Image
            source={{ uri: sizedPhotoUrl(account.photoUrl, 40) }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <UserRound size={18} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>G</Text>
        </View>
      </Pressable>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />

          <View
            style={[
              styles.menu,
              { top: menuPosition.top, right: menuPosition.right },
            ]}
          >
            <View style={styles.menuHeader}>
              {account.photoUrl ? (
                <Image
                  source={{ uri: sizedPhotoUrl(account.photoUrl, 36) }}
                  style={styles.menuAvatar}
                />
              ) : (
                <View style={styles.menuAvatarFallback}>
                  <UserRound size={16} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.menuText}>
                <Text style={styles.menuName} numberOfLines={1}>
                  {account.name ?? "Conta Google"}
                </Text>
                <Text style={styles.menuEmail} numberOfLines={1}>
                  {account.email}
                </Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            <Pressable
              onPress={() => void handleDisconnect()}
              disabled={disconnecting}
              style={[styles.menuAction, disconnecting && styles.menuActionDisabled]}
            >
              {disconnecting ? (
                <ActivityIndicator color={colors.error} size="small" />
              ) : (
                <Unlink size={16} color={colors.error} />
              )}
              <Text style={styles.menuActionText}>
                {disconnecting ? "Desconectando..." : "Desconectar"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    button: {
      width: 40,
      height: 40,
      position: "relative",
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.border,
    },
    avatarFallback: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.backgroundElement,
    },
    badge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 16,
      height: 16,
      borderRadius: 8,
      // Branco e azul do Google: cor de marca, fixa nos dois temas por exigência
      // das diretrizes de identidade deles.
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#4285F4",
      lineHeight: 11,
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.18)",
    },
    menu: {
      position: "absolute",
      minWidth: 220,
      maxWidth: 280,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    menuHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    menuAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    menuAvatarFallback: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.backgroundElement,
    },
    menuText: {
      flex: 1,
      gap: 2,
    },
    menuName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    menuEmail: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    menuDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 10,
    },
    menuAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderRadius: 10,
    },
    menuActionDisabled: {
      opacity: 0.7,
    },
    menuActionText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.error,
    },
  });
