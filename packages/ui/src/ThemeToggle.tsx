import React from "react";
import { useTheme } from "./theme";
import { Icon } from "./Icons";

export function ThemeToggle({ onToggle }: { onToggle: () => void }) {
  const isDark = useTheme().mode === "dark";
  return <button type="button" className="icon-button theme-toggle" onClick={onToggle}
    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
    <Icon name={isDark ? "sun" : "moon"} />
  </button>;
}
