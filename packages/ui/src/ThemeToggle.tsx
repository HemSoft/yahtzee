import React from "react";
import { useTheme } from "./theme";

interface ThemeToggleProps {
  onToggle: () => void;
}

export function ThemeToggle({ onToggle }: ThemeToggleProps) {
  const theme = useTheme();
  const isDark = theme.mode === "dark";

  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        fontSize: "1.4rem",
        padding: "0.4rem 0.6rem",
        borderRadius: "50%",
        border: `1px solid ${theme.border}`,
        background: theme.surface,
        color: theme.text,
        cursor: "pointer",
        zIndex: 1000,
        lineHeight: 1,
      }}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
