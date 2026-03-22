import React from "react";
import {
  getCategories,
  getUpperBonusThreshold,
  getUpperBonusValue,
  type CategoryId,
  type PlayerState,
} from "@yahtzee/game-engine";
import { calculateTotal, calculateMaxPossibleScore } from "@yahtzee/game-engine";
import { useTheme } from "./theme";

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
  leaderboardScores?: number[];
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
  leaderboardScores = [],
}: ScorecardProps) {
  const cats = getCategories(diceCount);
  const upperCats = cats.filter((c) => c.section === "upper");
  const lowerCats = cats.filter((c) => c.section === "lower");
  const bonusThreshold = getUpperBonusThreshold(diceCount);
  const bonusValue = getUpperBonusValue(diceCount);

  const canSelect = canInteract && hasRolled;

  const playerTotals = players.map((p) => calculateTotal(p, diceCount));

  // Current game ranks (handle ties)
  const gameRanks = computeRanks(playerTotals.map((t) => t.grandTotal));

  // Max possible score per player + best leaderboard rank
  const maxScores = players.map((p) => calculateMaxPossibleScore(p, diceCount));
  const bestLeaderboardRanks = maxScores.map((max) => {
    let rank = 1;
    for (const s of leaderboardScores) {
      if (s > max) rank++;
      else break;
    }
    return rank;
  });

  const theme = useTheme();
  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "4px 8px",
    borderBottom: `2px solid ${theme.borderStrong}`,
    color: theme.text,
  };
  const tdStyle: React.CSSProperties = {
    padding: "4px 8px",
    borderBottom: `1px solid ${theme.border}`,
    color: theme.text,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      {canSelect && (
        <p style={{ textAlign: "center", color: theme.textMuted, fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
          Click any highlighted row to place your score
        </p>
      )}
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
                  background: i === currentPlayerIndex ? theme.currentPlayerBg : undefined,
                  borderBottom: i === currentPlayerIndex ? `3px solid ${theme.currentPlayerBorder}` : `2px solid ${theme.borderStrong}`,
                  lineHeight: "1.3",
                }}
              >
                <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
                  {playerTotals[i].grandTotal} pts
                </div>
                <div style={{ fontSize: "0.75rem", color: theme.textMuted, fontWeight: "normal" }}>
                  #{gameRanks[i]} in game
                  {leaderboardScores.length > 0 && (
                    <> · best: #{bestLeaderboardRanks[i]}</>
                  )}
                </div>
                <div>{p.name}{p.isAi ? " 🤖" : ""}</div>
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
                  background: isSuggested && isAvailable ? theme.suggestionBg : isAvailable ? theme.availableBg : "transparent",
                  fontWeight: isSuggested && isAvailable ? "bold" : "normal",
                  borderLeft: isAvailable ? `3px solid ${theme.availableBorder}` : "3px solid transparent",
                }}
              >
                <td style={tdStyle}>
                  {isSuggested && isAvailable ? "⭐ " : isAvailable ? "► " : ""}{cat.label}
                </td>
                {players.map((p, i) => (
                  <td
                    key={p.id}
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      background: i === currentPlayerIndex ? `${theme.currentPlayerBorder}0a` : undefined,
                    }}
                  >
                    <ScoreCell
                      scored={p.scores[cat.id]}
                      potential={i === currentPlayerIndex && isAvailable ? cat.score(currentDice) : undefined}
                      potentialColor={theme.scorePotential}
                    />
                  </td>
                ))}
              </tr>
            );
          })}

          {/* Upper subtotal + bonus */}
          <tr style={{ fontWeight: "bold", background: theme.subtotalBg, color: theme.text }}>
            <td style={tdStyle}>Upper Subtotal</td>
            {playerTotals.map((t, i) => (
              <td key={i} style={{ ...tdStyle, textAlign: "center" }}>{t.upperSubtotal} / {bonusThreshold}</td>
            ))}
          </tr>
          <tr style={{ fontWeight: "bold", background: theme.subtotalBg, color: theme.text }}>
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
                  background: isSuggested && isAvailable ? theme.suggestionBg : isAvailable ? theme.availableBg : "transparent",
                  fontWeight: isSuggested && isAvailable ? "bold" : "normal",
                  borderLeft: isAvailable ? `3px solid ${theme.availableBorder}` : "3px solid transparent",
                }}
              >
                <td style={tdStyle}>
                  {isSuggested && isAvailable ? "⭐ " : isAvailable ? "► " : ""}{cat.label}
                </td>
                {players.map((p, i) => (
                  <td
                    key={p.id}
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      background: i === currentPlayerIndex ? `${theme.currentPlayerBorder}0a` : undefined,
                    }}
                  >
                    <ScoreCell
                      scored={p.scores[cat.id]}
                      potential={i === currentPlayerIndex && isAvailable ? cat.score(currentDice) : undefined}
                      potentialColor={theme.scorePotential}
                    />
                  </td>
                ))}
              </tr>
            );
          })}

          {/* Grand total */}
          <tr style={{ fontWeight: "bold", background: theme.grandTotalBg, color: theme.text }}>
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

function ScoreCell({ scored, potential, potentialColor }: { scored: number | undefined; potential: number | undefined; potentialColor: string }) {
  if (scored !== undefined) return <>{scored}</>;
  if (potential !== undefined) return <span style={{ color: potentialColor, fontStyle: "italic" }}>{potential}</span>;
  return <>—</>;
}

function computeRanks(scores: number[]): number[] {
  const indexed = scores.map((s, i) => ({ i, s })).sort((a, b) => b.s - a.s);
  const ranks = new Array<number>(scores.length);
  let rank = 1;
  for (let j = 0; j < indexed.length; j++) {
    if (j > 0 && indexed[j].s < indexed[j - 1].s) rank = j + 1;
    ranks[indexed[j].i] = rank;
  }
  return ranks;
}
