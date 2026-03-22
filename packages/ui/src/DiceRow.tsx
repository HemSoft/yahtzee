import React, { useState } from "react";
import { useTheme } from "./theme";

interface DieProps {
  value: number;
  held: boolean;
  onToggleHold: () => void;
  disabled?: boolean;
}

const DIE_FACES: Record<number, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

export function Die({ value, held, onToggleHold, disabled }: DieProps) {
  const theme = useTheme();
  return (
    <button
      onClick={onToggleHold}
      disabled={disabled}
      style={{
        fontSize: "3rem",
        padding: "0.5rem",
        border: held ? `3px solid ${theme.heldBorder}` : "3px solid transparent",
        borderRadius: "12px",
        background: held ? theme.heldBg : theme.dieBg,
        color: theme.text,
        cursor: disabled ? "default" : "pointer",
        transition: "all 0.15s ease",
        minWidth: "4rem",
        minHeight: "4rem",
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
}

export function DiceRow({ dice, held, onToggleHold, disabled }: DiceRowProps) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
      {dice.map((value, i) => (
        <Die
          key={i}
          value={value}
          held={held.has(i)}
          onToggleHold={() => onToggleHold(i)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
