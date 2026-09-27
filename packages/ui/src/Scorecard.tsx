import React from "react";
import { Icon } from "./Icons";
import {
  getCategories, getUpperBonusThreshold, getUpperBonusValue, calculateTotal, calculateMaxPossibleScore,
  type CategoryId, type PlayerState,
} from "@yahtzee/game-engine";

// Presentation order only: engine order also decides AI tie-breaking.
const DISPLAY_AFTER: Partial<Record<CategoryId, CategoryId>> = {
  "two-pairs": "three-pairs",
  "four-of-a-kind": "five-of-a-kind",
  "full-house": "castle",
  "large-straight": "full-straight",
};

function getScorecardCategories(diceCount: number) {
  const categories = getCategories(diceCount);
  const moved = new Set(Object.values(DISPLAY_AFTER));
  return categories.filter((category) => !moved.has(category.id)).flatMap((category) => {
    const extra = categories.find((candidate) => candidate.id === DISPLAY_AFTER[category.id]);
    return extra ? [category, extra] : [category];
  });
}

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
  compact?: boolean;
}

export function Scorecard({ players, currentPlayerIndex, currentDice, availableCategories, onSelectCategory,
  canInteract, hasRolled, diceCount = 5, suggestedCategory, leaderboardScores = [], compact = false }: ScorecardProps) {
  const categories = getScorecardCategories(diceCount);
  const totals = players.map((player) => calculateTotal(player, diceCount));
  const ranks = totals.map((total) => 1 + totals.filter((other) => other.grandTotal > total.grandTotal).length);
  const threshold = getUpperBonusThreshold(diceCount);
  const bonus = getUpperBonusValue(diceCount);
  const canSelect = canInteract && hasRolled;
  const sections = [{ id: "upper", label: "Numbers" }, { id: "lower", label: "Combinations" }] as const;

  return <section className={`scorecard${compact ? " scorecard-compact" : ""}${players.length > 2 ? " with-opponents" : ""}`} aria-label="Scorecard">
    <div className="scorecard-heading"><h2>Scorecard</h2><span>{canSelect ? "Choose a category to score" : "Your scores, one turn at a time"}</span></div>
    <div className="scorecard-scroll" data-testid="scorecard-scroll-container">
      <div className="scorecard-sections">
        {sections.map((section) => <div className={`score-section ${section.id}`} key={section.id}>
          <table>
            <caption>{section.label}</caption>
            <thead><tr><th scope="col">Category</th>{players.map((player, index) => <th scope="col" key={player.id}
              className={index === currentPlayerIndex ? "current-player" : undefined} title={player.name}>
              <span className="player-name">{player.name}</span><span className="player-kind">{player.isAi ? "AI" : "You"}</span>
            </th>)}</tr></thead>
            <tbody>
              {categories.filter((category) => category.section === section.id).map((category) => {
                const available = canSelect && availableCategories.includes(category.id);
                const suggested = available && suggestedCategory === category.id;
                return <tr key={category.id} className={`${available ? "available" : ""}${suggested ? " suggested" : ""}`}
                  onClick={available ? () => onSelectCategory(category.id) : undefined}>
                  <td><button type="button" className="yahtzee-score-action" disabled={!available} aria-label={`Score ${category.label}`}
                    onClick={(event) => { event.stopPropagation(); onSelectCategory(category.id); }}>
                    <span>{category.label}</span>{suggested && <span className="suggested-mark" title="Suggested category" aria-label="Suggested"><Icon name="arrow" size={12} /></span>}
                  </button></td>
                  {players.map((player, index) => {
                    const scored = player.scores[category.id];
                    const potential = index === currentPlayerIndex && available ? category.score(currentDice) : undefined;
                    return <td key={player.id} className={`score-value${scored !== undefined ? " scored" : ""}${potential !== undefined ? " potential" : ""}`}>
                      <span>{scored ?? potential ?? "—"}</span>
                    </td>;
                  })}
                </tr>;
              })}
              {section.id === "upper" && <>
                <tr className="subtotal"><th scope="row">Upper Subtotal</th>{totals.map((total, index) => <td className="score-value" key={players[index].id}>{total.upperSubtotal}<span className="threshold"> / {threshold}</span></td>)}</tr>
                <tr className="subtotal"><th scope="row">Upper Bonus</th>{totals.map((total, index) => <td className="score-value" key={players[index].id}>{total.upperBonus > 0 ? `+${bonus}` : "—"}</td>)}</tr>
              </>}
            </tbody>
          </table>
          {section.id === "upper" && <div className="bonus-note">
            <div><span>Bonus target</span><strong>{totals[currentPlayerIndex]?.upperSubtotal ?? 0} / {threshold}</strong></div>
            <progress max={threshold} value={Math.min(totals[currentPlayerIndex]?.upperSubtotal ?? 0, threshold)} aria-label="Upper bonus progress" />
            <p>Reach {threshold} in Numbers for a {bonus}-point bonus.</p>
            {canSelect && <p className="score-legend"><span className="legend-swatch" /> Suggested pick. Other available scores are outlined.</p>}
          </div>}
        </div>)}
      </div>
      <table className="totals-table"><tbody><tr><th scope="row">Grand Total</th>{players.map((player, index) => {
        const bestRank = 1 + leaderboardScores.filter((score) => score > calculateMaxPossibleScore(player, diceCount)).length;
        return <td key={player.id}><span className="total-name">{player.name}</span><strong>{totals[index].grandTotal}<small> pts</small></strong>
          <span className="rank-note">#{ranks[index]} in game · best: #{bestRank}</span></td>;
      })}</tr></tbody></table>
    </div>
  </section>;
}
