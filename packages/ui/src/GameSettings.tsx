import React from "react";

interface GameSettingsProps {
  diceCount: number;
  onDiceCountChange: (count: number) => void;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  aiOpponents: number;
  onAiOpponentsChange: (count: number) => void;
  onStartGame: () => void;
  disabled?: boolean;
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
}: GameSettingsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
      <div>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.25rem" }}>
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
            border: "1px solid #ccc",
            width: "100%",
          }}
        />
      </div>

      <div>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.25rem" }}>
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
                border: aiOpponents === preset.value ? "2px solid #9c27b0" : "2px solid #ddd",
                background: aiOpponents === preset.value ? "#f3e5f5" : "#fff",
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
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.25rem" }}>
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
                border: diceCount === preset.value ? "2px solid #2196f3" : "2px solid #ddd",
                background: diceCount === preset.value ? "#e3f2fd" : "#fff",
                cursor: "pointer",
                fontWeight: diceCount === preset.value ? "bold" : "normal",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <label style={{ fontSize: "0.8rem", color: "#666" }}>
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
              style={{ width: "60px", padding: "0.25rem" }}
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
          background: disabled || !playerName.trim() ? "#ccc" : "#4caf50",
          color: "#fff",
          cursor: disabled || !playerName.trim() ? "default" : "pointer",
        }}
      >
        Start Game
      </button>
    </div>
  );
}
