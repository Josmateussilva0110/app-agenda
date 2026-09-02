import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, type KeyboardEvent } from "react-native";

const SHOW_EVENT =
  Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
const HIDE_EVENT =
  Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

export function useKeyboardInset(enabled = true) {
  const [height, setHeight] = useState(0);
  const lastHeightRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setHeight(0);
      return;
    }

    const onShow = (event: KeyboardEvent) => {
      lastHeightRef.current = event.endCoordinates.height;
      setHeight(event.endCoordinates.height);
    };

    const onHide = () => {
      setHeight(0);
    };

    const showSubscription = Keyboard.addListener(SHOW_EVENT, onShow);
    const hideSubscription = Keyboard.addListener(HIDE_EVENT, onHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [enabled]);

  const readCurrentHeight = useCallback(() => {
    const metrics = Keyboard.metrics();

    if (metrics?.height && metrics.height > 0) {
      lastHeightRef.current = metrics.height;
      return metrics.height;
    }

    return lastHeightRef.current;
  }, []);

  return {
    height,
    isVisible: height > 0,
    lastHeight: lastHeightRef.current,
    readCurrentHeight,
  };
}
