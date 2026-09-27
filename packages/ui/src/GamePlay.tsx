import React from "react";
import { calculateTotal, getAvailableCategories, getCategories, pickAiCategory, type GameState } from "@yahtzee/game-engine";
import { DiceRow } from "./DiceRow";
import { Scorecard } from "./Scorecard";
import { Icon } from "./Icons";
import type { useGameSession } from "./useGameSession";

type Session = ReturnType<typeof useGameSession>;
type Category = ReturnType<typeof getCategories>[number];
interface PlayProps {
  session: Session;
  game: GameState;
  desktop: boolean;
  leaderboardScores: number[];
  rolling: boolean;
  rollKey: number;
  onRoll: () => void;
  onRollSettled: () => void;
}

function TurnSummary({ game, suggestedCategory }: { game: GameState; suggestedCategory?: Category }) {
  const player = game.players[game.currentPlayerIndex];
  const total = calculateTotal(player, game.diceCount).grandTotal;
  return <div className="turn-summary">
    <div><span>Your score</span><strong key={total}>{total}<small> pts</small></strong></div>
    {suggestedCategory && <div className="suggestion-summary"><span>Suggested pick</span><strong>{suggestedCategory.label}</strong><small>{suggestedCategory.score(game.dice)} points this roll</small></div>}
  </div>;
}

function moveStatus(session: Session, game: GameState) {
  if (session.busy) return "Saving move...";
  if (session.canRetry) return "Retry your move to continue.";
  if (game.players[game.currentPlayerIndex].isAi) return "AI is thinking...";
  return game.held.size ? `${game.held.size} of ${game.diceCount} dice held` : "Every roll is a new possibility.";
}

function RollControls({ game, session, canInteract, onRoll }: { game: GameState; session: Session; canInteract: boolean; onRoll: () => void }) {
  return <div className="roll-controls">
    <div className="roll-status"><span className="roll-dots" aria-hidden="true">{[1, 2, 3].map((step) => <i key={step} className={step <= game.maxRolls - game.rollsLeft ? "used" : ""} />)}</span><span>{game.rollsLeft} {game.rollsLeft === 1 ? "roll" : "rolls"} left</span></div>
    <button type="button" className="button roll-button" onClick={onRoll} disabled={!canInteract || game.rollsLeft === 0}>
      <Icon name="dice" size={22} />{game.rollsLeft === game.maxRolls ? "Roll Dice" : `Re-roll (${game.rollsLeft})`}
    </button>
    <p className="move-status">{moveStatus(session, game)}</p>
  </div>;
}

function DiceDeck({ game, session, canInteract, suggestedCategory, onRoll, onRollSettled, rolling, rollKey }: Omit<PlayProps, "desktop" | "leaderboardScores"> & { canInteract: boolean; suggestedCategory?: Category }) {
  const player = game.players[game.currentPlayerIndex];
  return <section className="play-deck" aria-label="Dice and turn controls">
    <div className="turn-heading"><span className="turn-indicator" /><p>{player.name}'s turn</p><span className="round-count">Round {Math.min(game.currentRound, game.totalRounds)} / {game.totalRounds}</span></div>
    <div className="turn-title"><h2>{game.rollsLeft === 0 ? "Make your move." : game.held.size ? "Keep a good thing." : "Let them roll."}</h2><p>{game.rollsLeft === 0 ? "Choose a category on your scorecard." : "Select dice to hold for the next roll."}</p></div>
    <div className="dice-stage" onAnimationEnd={onRollSettled}>
      <DiceRow dice={game.dice} held={game.held} onToggleHold={session.toggleHold} disabled={!canInteract || game.rollsLeft === 0}
        rolling={rolling && session.busy} rollKey={rollKey} />
    </div>
    <RollControls game={game} session={session} canInteract={canInteract} onRoll={onRoll} />
    <TurnSummary game={game} suggestedCategory={suggestedCategory} />
  </section>;
}

export function GamePlay(props: PlayProps) {
  const { game, session, desktop, leaderboardScores } = props;
  const player = game.players[game.currentPlayerIndex];
  const canInteract = !player.isAi && !session.busy && !session.canRetry;
  const hasRolled = game.rollsLeft < game.maxRolls;
  const suggestion = !player.isAi && hasRolled ? pickAiCategory(game.dice, player, game.diceCount) : undefined;
  const suggestedCategory = getCategories(game.diceCount).find((category) => category.id === suggestion);
  return <div className="play-layout">
    <DiceDeck {...props} canInteract={canInteract} suggestedCategory={suggestedCategory} />
    <Scorecard players={game.players} currentPlayerIndex={game.currentPlayerIndex} currentDice={game.dice}
      availableCategories={!player.isAi ? getAvailableCategories(player, game.diceCount) : []} onSelectCategory={session.selectCategory}
      canInteract={canInteract} hasRolled={hasRolled} diceCount={game.diceCount} suggestedCategory={suggestion}
      leaderboardScores={leaderboardScores} compact={desktop} />
  </div>;
}
