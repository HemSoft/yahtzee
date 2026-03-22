import React from "react";
import {
  getCategories,
  getUpperBonusThreshold,
  getUpperBonusValue,
  type CategoryId,
  type PlayerState,
} from "@yahtzee/game-engine";
import { calculateTotal } from "@yahtzee/game-engine";

interface ScorecardProps {
  players: PlayerState[];
  currentPlayerIndex: number;
  currentDice: number[];
  availableCategories: CategoryId[];
  onSelectCategory: (categoryId: CategoryId) => void;
  canInteract: boolean;
  hasRolled: boolean;
  diceCount?: number;
  suggestedCategory?: CategoryId;
}

export function Scorecard({
  players,
  currentPlayerIndex,
  currentDice,
  availableCategories,
  onSelectCategory,
  canInteract,
  hasRolled,
  diceCount = 5,
  suggestedCategory,
}: ScorecardProps) {
  const cats = getCategories(diceCount);
  const upperCats = cats.filter((c) => c.section === "upper");
  const lowerCats = cats.filter((c) => c.section === "lower");
  const bonusThreshold = getUpperBonusThreshold(diceCount);
  const bonusValue = getUpperBonusValue(diceCount);

  const canSelect = canInteract && hasRolled;

  const playerTotals = players.map((p) => calculateTotal(p, diceCount));

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr>
            <th style={thStyle}>Category</th>
            {players.map((p, i) => (
              <th
                key={p.id}
                style={{
                  ...thStyle,
                  textAlign: "center",
                  minWidth: "80px",
                  background: i === currentPlayerIndex ? "#e3f2fd" : undefined,
                  borderBottom: i === currentPlayerIndex ? "3px solid #2196f3" : "2px solid #333",
                }}
              >
                {p.name}{p.isAi ? " 🤖" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Upper section */}
          {upperCats.map((cat) => {
            const isSuggested = suggestedCategory === cat.id;
            const isAvailable = canSelect && availableCategories.includes(cat.id);
            return (
              <tr
                key={cat.id}
                onClick={isAvailable ? () => onSelectCategory(cat.id) : undefined}
                style={{
                  cursor: isAvailable ? "pointer" : "default",
                  background: isSuggested && isAvailable ? "#c8e6c9" : isAvailable ? "#fffde7" : "transparent",
                  fontWeight: isSuggested && isAvailable ? "bold" : "normal",
                }}
              >
                <td style={tdStyle}>{isSuggested && isAvailable ? "⭐ " : ""}{cat.label}</td>
                {players.map((p, i) => (
                  <td
                    key={p.id}
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      background: i === currentPlayerIndex ? "rgba(33,150,243,0.04)" : undefined,
                    }}
                  >
                    <ScoreCell
                      scored={p.scores[cat.id]}
                      potential={i === currentPlayerIndex && isAvailable ? cat.score(currentDice) : undefined}
                    />
                  </td>
                ))}
              </tr>
            );
          })}

          {/* Upper subtotal + bonus */}
          <tr style={{ fontWeight: "bold", background: "#f0f0f0" }}>
            <td style={tdStyle}>Upper Subtotal</td>
            {playerTotals.map((t, i) => (
              <td key={i} style={{ ...tdStyle, textAlign: "center" }}>{t.upperSubtotal} / {bonusThreshold}</td>
            ))}
          </tr>
          <tr style={{ fontWeight: "bold", background: "#f0f0f0" }}>
            <td style={tdStyle}>Upper Bonus</td>
            {playerTotals.map((t, i) => (
              <td key={i} style={{ ...tdStyle, textAlign: "center" }}>{t.upperBonus > 0 ? `+${bonusValue}` : "—"}</td>
            ))}
          </tr>

          {/* Lower section */}
          {lowerCats.map((cat) => {
            const isSuggested = suggestedCategory === cat.id;
            const isAvailable = canSelect && availableCategories.includes(cat.id);
            return (
              <tr
                key={cat.id}
                onClick={isAvailable ? () => onSelectCategory(cat.id) : undefined}
                style={{
                  cursor: isAvailable ? "pointer" : "default",
                  background: isSuggested && isAvailable ? "#c8e6c9" : isAvailable ? "#fffde7" : "transparent",
                  fontWeight: isSuggested && isAvailable ? "bold" : "normal",
                }}
              >
                <td style={tdStyle}>{isSuggested && isAvailable ? "⭐ " : ""}{cat.label}</td>
                {players.map((p, i) => (
                  <td
                    key={p.id}
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      background: i === currentPlayerIndex ? "rgba(33,150,243,0.04)" : undefined,
                    }}
                  >
                    <ScoreCell
                      scored={p.scores[cat.id]}
                      potential={i === currentPlayerIndex && isAvailable ? cat.score(currentDice) : undefined}
                    />
                  </td>
                ))}
              </tr>
            );
          })}

          {/* Grand total */}
          <tr style={{ fontWeight: "bold", background: "#e8e8e8" }}>
            <td style={tdStyle}>Grand Total</td>
            {playerTotals.map((t, i) => (
              <td key={i} style={{ ...tdStyle, textAlign: "center", fontSize: "1rem" }}>{t.grandTotal}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────

function ScoreCell({ scored, potential }: { scored: number | undefined; potential: number | undefined }) {
  if (scored !== undefined) return <>{scored}</>;
  if (potential !== undefined) return <span style={{ color: "#888", fontStyle: "italic" }}>{potential}</span>;
  return <>—</>;
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  borderBottom: "2px solid #333",
};

const tdStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderBottom: "1px solid #ddd",
};
