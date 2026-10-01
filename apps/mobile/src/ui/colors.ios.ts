import { DynamicColorIOS, PlatformColor } from "react-native";
import { fallbackColors, type NativeColors } from "./palette";

export function nativeColors(dark: boolean): NativeColors {
  return { ...fallbackColors(dark),
    page: PlatformColor("systemGroupedBackground"), surface: PlatformColor("secondarySystemGroupedBackground"),
    text: PlatformColor("label"), muted: PlatformColor("secondaryLabel"), line: PlatformColor("separator"),
    error: PlatformColor("systemRed"),
    tint: DynamicColorIOS({ light: "#92431f", dark: "#ffba93", highContrastLight: "#672909", highContrastDark: "#ffc3a4" }),
  };
}
