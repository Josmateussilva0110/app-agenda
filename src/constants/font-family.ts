import { Fonts } from "@/constants/theme";

type FontWeightKey =
  | "normal"
  | "bold"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
  | "ultralight"
  | "thin"
  | "light"
  | "medium"
  | "semibold"
  | "heavy"
  | "black";

export function fontFamilyForWeight(
  fontWeight?: FontWeightKey | string
): string {
  const weight = String(fontWeight ?? "400");

  if (weight === "bold" || weight === "700" || weight === "800" || weight === "900") {
    if (weight === "800" || weight === "900") return Fonts?.extraBold ?? Fonts?.bold ?? "System";
    return Fonts?.bold ?? "System";
  }

  if (weight === "600" || weight === "semibold") {
    return Fonts?.semiBold ?? "System";
  }

  if (weight === "500" || weight === "medium") {
    return Fonts?.medium ?? "System";
  }

  return Fonts?.sans ?? "System";
}
