import { View, type ViewProps } from "react-native";

type KeyboardSafeAreaProps = ViewProps & {
  inset: number;
  extra?: number;
};

export function KeyboardSafeArea({
  inset,
  extra = 0,
  style,
  ...props
}: KeyboardSafeAreaProps) {
  if (inset <= 0) return null;

  return <View style={[{ height: inset + extra }, style]} {...props} />;
}
