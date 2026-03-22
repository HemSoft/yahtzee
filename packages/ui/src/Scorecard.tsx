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
  player: PlayerState;
  currentDice: number[];
  availableCategories: CategoryId[];
  onSelectCategory: (categoryId: CategoryId) => void;
  isCurrentPlayer: boolean;
  hasRolled: boolean;
  diceCount?: number;
  suggestedCategory?: CategoryId;
}

export function Scorecard({
  player,
  currentDice,
  availableCategories,
  onSelectCategory,
  isCurrentPlayer,
  hasRolled,
  diceCount = 5,
  suggestedCategory,
}: ScorecardProps) {
  const totals = calculateTotal(player, diceCount);
  const cats = getCategories(diceCount);
  const upperCats = cats.filter((c) => c.section === "upper");
  const lowerCats = cats.filter((c) => c.section === "lower");
  const bonusThreshold = getUpperBonusThreshold(diceCount);
  const bonusValue = getUpperBonusValue(diceCount);

  const canSelect = isCurrentPlayer && hasRolled;

  return (
    <div style={{ minWidth: "280px" }}>
      <h3 style={{ margin: "0 0 0.5rem" }}>{player.name}</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr>
            <th style={thStyle}>Category</th>
            <th style={thStyle}>Score</th>
          </tr>
        </thead>
        <tbody>
          {/* Upper section */}
          {upperCats.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              scored={player.scores[cat.id]}
              potential={canSelect && availableCategories.includes(cat.id) ? cat.score(currentDice) : undefined}
              onSelect={() => onSelectCategory(cat.id)}
              canSelect={canSelect && availableCategories.includes(cat.id)}
              isSuggested={suggestedCategory === cat.id}
            />
          ))}
          <tr style={{ fontWeight: "bold", background: "#f0f0f0" }}>
            <td style={tdStyle}>Upper Subtotal</td>
            <td style={tdStyle}>{totals.upperSubtotal} / {bonusThreshold}</td>
          </tr>
          <tr style={{ fontWeight: "bold", background: "#f0f0f0" }}>
            <td style={tdStyle}>Upper Bonus</td>
            <td style={tdStyle}>{totals.upperBonus > 0 ? `+${bonusValue}` : "—"}</td>
          </tr>

          {/* Lower section */}
          {lowerCats.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              scored={player.scores[cat.id]}
              potential={canSelect && availableCategories.includes(cat.id) ? cat.score(currentDice) : undefined}
              onSelect={() => onSelectCategory(cat.id)}
              canSelect={canSelect && availableCategories.includes(cat.id)}
              isSuggested={suggestedCategory === cat.id}
            />
          ))}

          <tr style={{ fontWeight: "bold", background: "#e8e8e8" }}>
            <td style={tdStyle}>Grand Total</td>
            <td style={tdStyle}>{totals.grandTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────

function CategoryRow({
  cat,
  scored,
  potential,
  onSelect,
  canSelect,
  isSuggested,
}: {
  cat: { id: CategoryId; label: string };
  scored: number | undefined;
  potential: number | undefined;
  onSelect: () => void;
  canSelect: boolean;
  isSuggested: boolean;
}) {
  const isScored = scored !== undefined;

  return (
    <tr
      onClick={canSelect ? onSelect : undefined}
      style={{
        cursor: canSelect ? "pointer" : "default",
        background: isSuggested && canSelect ? "#c8e6c9" : canSelect ? "#fffde7" : "transparent",
        fontWeight: isSuggested && canSelect ? "bold" : "normal",
      }}
    >
      <td style={tdStyle}>
        {isSuggested && canSelect ? "⭐ " : ""}{cat.label}
      </td>
      <td style={tdStyle}>
        {isScored ? (
          scored
        ) : potential !== undefined ? (
          <span style={{ color: "#888", fontStyle: "italic" }}>{potential}</span>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
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
