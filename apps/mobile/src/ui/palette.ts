import type { ColorValue } from "react-native";

export interface NativeColors {
  page: ColorValue; surface: ColorValue; text: ColorValue; muted: ColorValue;
  line: ColorValue; tint: ColorValue; error: ColorValue; deck: ColorValue;
  deckText: ColorValue; die: ColorValue; pip: ColorValue; held: ColorValue;
  action: ColorValue; actionText: ColorValue;
}
/** Non-iOS fallback and the deliberately game-specific brand colors. */
export function fallbackColors(dark: boolean): NativeColors {
  return {
    page: dark ? "#182521" : "#eff2ee", surface: dark ? "#23352e" : "#ffffff",
    text: dark ? "#edf1e7" : "#203a34", muted: dark ? "#b4c4b6" : "#576a61",
    line: dark ? "#465e4c" : "#ccd7cd", tint: dark ? "#ffba93" : "#92431f",
    error: dark ? "#ffd0c5" : "#9c342c", deck: dark ? "#102f26" : "#1e453a",
    deckText: "#f5f4e9", die: "#f5f4e9", pip: "#244033", held: "#cee2af",
    action: "#f2a07e", actionText: "#35281f",
  };
}
