import React, { createContext, useContext } from "react";

export interface Theme {
  mode: "light" | "dark";
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryBg: string;
  accent: string;
  accentBg: string;
  success: string;
  successBg: string;
  suggestionBg: string;
  availableBg: string;
  availableBorder: string;
  heldBorder: string;
  heldBg: string;
  dieBg: string;
  disabledBg: string;
  currentPlayerBg: string;
  currentPlayerBorder: string;
  subtotalBg: string;
  grandTotalBg: string;
  topThreeBg: string;
  scorePotential: string;
}

export const lightTheme: Theme = {
  mode: "light",
  bg: "#ffffff",
  surface: "#fff",
  surfaceAlt: "#f5f5f5",
  text: "#222",
  textMuted: "#666",
  border: "#ddd",
  borderStrong: "#333",
  primary: "#2196f3",
  primaryBg: "#e3f2fd",
  accent: "#9c27b0",
  accentBg: "#f3e5f5",
  success: "#4caf50",
  successBg: "#e8f5e9",
  suggestionBg: "#c8e6c9",
  availableBg: "#fff9c4",
  availableBorder: "#fbc02d",
  heldBorder: "#2e7d32",
  heldBg: "#e8f5e9",
  dieBg: "#f5f5f5",
  disabledBg: "#ccc",
  currentPlayerBg: "#e3f2fd",
  currentPlayerBorder: "#2196f3",
  subtotalBg: "#f0f0f0",
  grandTotalBg: "#e8e8e8",
  topThreeBg: "#fffde7",
  scorePotential: "#888",
};

export const darkTheme: Theme = {
  mode: "dark",
  bg: "#1a1a2e",
  surface: "#16213e",
  surfaceAlt: "#0f3460",
  text: "#e0e0e0",
  textMuted: "#9e9e9e",
  border: "#334155",
  borderStrong: "#94a3b8",
  primary: "#64b5f6",
  primaryBg: "#1e3a5f",
  accent: "#ce93d8",
  accentBg: "#2d1b36",
  success: "#66bb6a",
  successBg: "#1b3a1b",
  suggestionBg: "#1b3a1b",
  availableBg: "#3a3520",
  availableBorder: "#f9a825",
  heldBorder: "#66bb6a",
  heldBg: "#1b3a1b",
  dieBg: "#0f3460",
  disabledBg: "#444",
  currentPlayerBg: "#1e3a5f",
  currentPlayerBorder: "#64b5f6",
  subtotalBg: "#1e293b",
  grandTotalBg: "#172033",
  topThreeBg: "#3a3520",
  scorePotential: "#9e9e9e",
};

const ThemeContext = createContext<Theme>(lightTheme);

export const ThemeProvider = ThemeContext.Provider;

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
