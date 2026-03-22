import React, { useState, useCallback } from "react";
import {
  createGame,
  rollDice,
  reroll,
  getAvailableCategories,
  isGameComplete,
  calculateTotal,
  CATEGORIES,
  type GameState,
  type CategoryId,
} from "@yahtzee/game-engine";
import { DiceRow, Scorecard, GameSettings } from "@yahtzee/ui";

type Screen = "setup" | "playing" | "finished";

export function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [playerName, setPlayerName] = useState("");
  const [diceCount, setDiceCount] = useState(5);
  const [game, setGame] = useState<GameState | null>(null);

  const handleStartGame = useCallback(() => {
    const g = createGame({
      id: crypto.randomUUID(),
      diceCount,
      players: [{ id: "local", name: playerName.trim() }],
    });
    g.status = "playing";
    setGame(g);
    setScreen("playing");
  }, [diceCount, playerName]);

  const handleRoll = useCallback(() => {
    if (!game || game.rollsLeft <= 0) return;
    setGame((prev) => {
      if (!prev) return prev;
      const newDice =
        prev.rollsLeft === prev.maxRolls
          ? rollDice(prev.diceCount)
          : reroll(prev.dice, prev.held);
      return { ...prev, dice: newDice, rollsLeft: prev.rollsLeft - 1 };
    });
  }, [game]);

  const handleToggleHold = useCallback(
    (index: number) => {
      if (!game || game.rollsLeft === game.maxRolls) return;
      setGame((prev) => {
        if (!prev) return prev;
        const newHeld = new Set(prev.held);
        if (newHeld.has(index)) newHeld.delete(index);
        else newHeld.add(index);
        return { ...prev, held: newHeld };
      });
    },
    [game]
  );

  const handleSelectCategory = useCallback(
    (categoryId: CategoryId) => {
      if (!game) return;
      const cat = CATEGORIES.find((c) => c.id === categoryId);
      if (!cat) return;

      setGame((prev) => {
        if (!prev) return prev;
        const player = { ...prev.players[0] };
        player.scores = { ...player.scores, [categoryId]: cat.score(prev.dice) };

        const newGame: GameState = {
          ...prev,
          players: [player],
          dice: new Array(prev.diceCount).fill(0),
          held: new Set(),
          rollsLeft: prev.maxRolls,
          currentRound: prev.currentRound + 1,
        };

        if (isGameComplete(newGame)) {
          newGame.status = "finished";
          setScreen("finished");
        }

        return newGame;
      });
    },
    [game]
  );

  const handlePlayAgain = useCallback(() => {
    setScreen("setup");
    setGame(null);
  }, []);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: "1.5rem" }}>🎲 Yahtzee</h1>

      {screen === "setup" && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <GameSettings
            diceCount={diceCount}
            onDiceCountChange={setDiceCount}
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            onStartGame={handleStartGame}
          />
        </div>
      )}

      {screen === "playing" && game && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ marginBottom: "0.5rem", color: "#666" }}>
              Round {Math.min(game.currentRound, game.totalRounds)} / {game.totalRounds}
              &nbsp;·&nbsp;Rolls left: {game.rollsLeft}
            </p>
            <DiceRow
              dice={game.dice}
              held={game.held}
              onToggleHold={handleToggleHold}
              disabled={game.rollsLeft === 0}
            />
            <button
              onClick={handleRoll}
              disabled={game.rollsLeft <= 0}
              style={{
                marginTop: "1rem",
                padding: "0.75rem 2rem",
                fontSize: "1.1rem",
                fontWeight: "bold",
                borderRadius: "8px",
                border: "none",
                background: game.rollsLeft > 0 ? "#2196f3" : "#ccc",
                color: "#fff",
                cursor: game.rollsLeft > 0 ? "pointer" : "default",
              }}
            >
              {game.rollsLeft === game.maxRolls ? "Roll Dice" : `Re-roll (${game.rollsLeft})`}
            </button>
          </div>

          <Scorecard
            player={game.players[0]}
            currentDice={game.dice}
            availableCategories={getAvailableCategories(game.players[0])}
            onSelectCategory={handleSelectCategory}
            isCurrentPlayer={true}
            hasRolled={game.rollsLeft < game.maxRolls}
          />
        </div>
      )}

      {screen === "finished" && game && (
        <div style={{ textAlign: "center" }}>
          <h2>Game Over!</h2>
          <p style={{ fontSize: "1.5rem", margin: "1rem 0" }}>
            Final Score: <strong>{calculateTotal(game.players[0]).grandTotal}</strong>
          </p>
          <button
            onClick={handlePlayAgain}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 2rem",
              fontSize: "1.1rem",
              fontWeight: "bold",
              borderRadius: "8px",
              border: "none",
              background: "#4caf50",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
