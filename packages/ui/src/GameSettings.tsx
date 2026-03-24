import React from "react";
import { useTheme } from "./theme";

interface GameSettingsProps {
  diceCount: number;
  onDiceCountChange: (count: number) => void;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  aiOpponents: number;
  onAiOpponentsChange: (count: number) => void;
  onStartGame: () => void;
  disabled?: boolean;
  recentNames?: string[];
}

const DICE_PRESETS = [
  { label: "Classic (5)", value: 5 },
  { label: "Extended (6)", value: 6 },
  { label: "Mega (8)", value: 8 },
  { label: "Ultra (10)", value: 10 },
];

const AI_PRESETS = [
  { label: "Solo", value: 0 },
  { label: "1 AI", value: 1 },
  { label: "2 AI", value: 2 },
  { label: "3 AI", value: 3 },
];

export function GameSettings({
  diceCount,
  onDiceCountChange,
  playerName,
  onPlayerNameChange,
  aiOpponents,
  onAiOpponentsChange,
  onStartGame,
  disabled,
  recentNames = [],
}: GameSettingsProps) {
  const theme = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
      <div>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.25rem", color: theme.text }}>
          Player Name
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => onPlayerNameChange(e.target.value)}
          placeholder="Enter your name"
          maxLength={20}
          style={{
            padding: "0.5rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: `1px solid ${theme.border}`,
            background: theme.surface,
            color: theme.text,
            width: "100%",
          }}
        />
        {recentNames.length > 0 && (
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
            {recentNames.map((name) => (
              <button
                key={name}
                onClick={() => onPlayerNameChange(name)}
                style={{
                  padding: "0.2rem 0.6rem",
                  borderRadius: "12px",
                  border: `1px solid ${theme.border}`,
                  background: playerName === name ? theme.accentBg : theme.surface,
                  color: playerName === name ? theme.accent : theme.textMuted,
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.25rem", color: theme.text }}>
          AI Opponents
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {AI_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onAiOpponentsChange(preset.value)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                border: aiOpponents === preset.value ? `2px solid ${theme.accent}` : `2px solid ${theme.border}`,
                background: aiOpponents === preset.value ? theme.accentBg : theme.surface,
                color: theme.text,
                cursor: "pointer",
                fontWeight: aiOpponents === preset.value ? "bold" : "normal",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.25rem", color: theme.text }}>
          Dice Count
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {DICE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onDiceCountChange(preset.value)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                border: diceCount === preset.value ? `2px solid ${theme.primary}` : `2px solid ${theme.border}`,
                background: diceCount === preset.value ? theme.primaryBg : theme.surface,
                color: theme.text,
                cursor: "pointer",
                fontWeight: diceCount === preset.value ? "bold" : "normal",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <label style={{ fontSize: "0.8rem", color: theme.textMuted }}>
            Custom:{" "}
            <input
              type="number"
              min={2}
              max={20}
              value={diceCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 2 && val <= 20) onDiceCountChange(val);
              }}
              style={{ width: "60px", padding: "0.25rem", background: theme.surface, color: theme.text, border: `1px solid ${theme.border}` }}
            />
          </label>
        </div>
      </div>

      <button
        onClick={onStartGame}
        disabled={disabled || !playerName.trim()}
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "1.1rem",
          fontWeight: "bold",
          borderRadius: "8px",
          border: "none",
          background: disabled || !playerName.trim() ? theme.disabledBg : theme.success,
          color: "#fff",
          cursor: disabled || !playerName.trim() ? "default" : "pointer",
        }}
      >
        Start Game
      </button>
    </div>
  );
}
