import React from "react";
import { useTheme } from "./theme";

interface DieProps {
  value: number;
  held: boolean;
  onToggleHold: () => void;
  disabled?: boolean;
  compact?: boolean;
}

const DIE_FACES: Record<number, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

export function Die({ value, held, onToggleHold, disabled, compact = false }: DieProps) {
  const theme = useTheme();
  return (
    <button
      onClick={onToggleHold}
      disabled={disabled}
      style={{
        fontSize: compact ? "2rem" : "3rem",
        padding: compact ? "0.2rem" : "0.5rem",
        border: held ? `3px solid ${theme.heldBorder}` : "3px solid transparent",
        borderRadius: "12px",
        background: held ? theme.heldBg : theme.dieBg,
        color: theme.text,
        cursor: disabled ? "default" : "pointer",
        transition: "all 0.15s ease",
        minWidth: compact ? "3rem" : "4rem",
        minHeight: compact ? "3rem" : "4rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label={`Die showing ${value}${held ? ", held" : ""}`}
    >
      {value > 0 ? DIE_FACES[value] ?? value : "?"}
    </button>
  );
}

interface DiceRowProps {
  dice: number[];
  held: Set<number>;
  onToggleHold: (index: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function DiceRow({ dice, held, onToggleHold, disabled, compact = false }: DiceRowProps) {
  return (
    <div style={{ display: "flex", gap: compact ? "0.4rem" : "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
      {dice.map((value, i) => (
        <Die
          key={i}
          value={value}
          held={held.has(i)}
          onToggleHold={() => onToggleHold(i)}
          disabled={disabled}
          compact={compact}
        />
      ))}
    </div>
  );
}
