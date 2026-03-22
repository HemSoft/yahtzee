import React, { useState, useCallback, useEffect } from "react";
import {
  createGame,
  rollDice,
  reroll,
  getAvailableCategories,
  isGameComplete,
  calculateTotal,
  executeAiTurn,
  getCategories,
  type GameState,
  type CategoryId,
} from "@yahtzee/game-engine";
import { DiceRow, Scorecard, GameSettings } from "@yahtzee/ui";

const AI_NAMES = ["Bot Alpha", "Bot Beta", "Bot Gamma"];

type Screen = "setup" | "playing" | "finished";

export function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [playerName, setPlayerName] = useState("");
  const [diceCount, setDiceCount] = useState(5);
  const [aiOpponents, setAiOpponents] = useState(0);
  const [game, setGame] = useState<GameState | null>(null);

  const handleStartGame = useCallback(() => {
    const players: { id: string; name: string; isAi?: boolean }[] = [
      { id: "local", name: playerName.trim() },
    ];
    for (let i = 0; i < aiOpponents; i++) {
      players.push({ id: `ai-${i}`, name: AI_NAMES[i], isAi: true });
    }
    const g = createGame({ id: crypto.randomUUID(), diceCount, players });
    g.status = "playing";
    setGame(g);
    setScreen("playing");
  }, [diceCount, playerName, aiOpponents]);

  const handleCancelGame = useCallback(() => {
    setScreen("setup");
    setGame(null);
  }, []);

  const advanceToNextPlayer = useCallback((g: GameState): GameState => {
    const nextIndex = (g.currentPlayerIndex + 1) % g.players.length;
    const nextRound = nextIndex === 0 ? g.currentRound + 1 : g.currentRound;
    return {
      ...g,
      currentPlayerIndex: nextIndex,
      dice: new Array(g.diceCount).fill(0),
      held: new Set(),
      rollsLeft: g.maxRolls,
      currentRound: nextRound,
    };
  }, []);

  useEffect(() => {
    if (!game || screen !== "playing") return;
    const current = game.players[game.currentPlayerIndex];
    if (!current.isAi) return;

    const timeout = setTimeout(() => {
      setGame((prev) => {
        if (!prev) return prev;
        let g = executeAiTurn(prev);
        if (isGameComplete(g)) {
          g.status = "finished";
          setScreen("finished");
          return g;
        }
        g = advanceToNextPlayer(g);
        return g;
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [game?.currentPlayerIndex, game?.currentRound, screen, advanceToNextPlayer]);

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
      const cats = getCategories(game.diceCount);
      const cat = cats.find((c) => c.id === categoryId);
      if (!cat) return;

      setGame((prev) => {
        if (!prev) return prev;
        const playerIdx = prev.currentPlayerIndex;
        const player = { ...prev.players[playerIdx] };
        player.scores = { ...player.scores, [categoryId]: cat.score(prev.dice) };

        const newPlayers = [...prev.players];
        newPlayers[playerIdx] = player;

        let newGame: GameState = { ...prev, players: newPlayers };

        if (isGameComplete(newGame)) {
          newGame.status = "finished";
          setScreen("finished");
          return newGame;
        }

        newGame = advanceToNextPlayer(newGame);
        return newGame;
      });
    },
    [game, advanceToNextPlayer]
  );

  const currentPlayer = game?.players[game.currentPlayerIndex];
  const isHumanTurn = currentPlayer && !currentPlayer.isAi;

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
            aiOpponents={aiOpponents}
            onAiOpponentsChange={setAiOpponents}
            onStartGame={handleStartGame}
          />
        </div>
      )}

      {screen === "playing" && game && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleCancelGame}
              style={{
                padding: "0.4rem 1rem",
                fontSize: "0.85rem",
                borderRadius: "6px",
                border: "1px solid #e57373",
                background: "#fff",
                color: "#c62828",
                cursor: "pointer",
              }}
            >
              ✕ Quit Game
            </button>
          </div>

          {game.players.length > 1 && (
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
              {game.players.map((p, i) => (
                <span
                  key={p.id}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: i === game.currentPlayerIndex ? "bold" : "normal",
                    background: i === game.currentPlayerIndex ? "#e3f2fd" : "#f5f5f5",
                    border: i === game.currentPlayerIndex ? "2px solid #2196f3" : "2px solid transparent",
                  }}
                >
                  {p.name}{p.isAi ? " 🤖" : ""} — {calculateTotal(p, game.diceCount).grandTotal}
                </span>
              ))}
            </div>
          )}

          <div style={{ textAlign: "center" }}>
            <p style={{ marginBottom: "0.5rem", color: "#666" }}>
              {currentPlayer?.name}'s turn &nbsp;·&nbsp;
              Round {Math.min(game.currentRound, game.totalRounds)} / {game.totalRounds}
              &nbsp;·&nbsp;Rolls left: {game.rollsLeft}
            </p>

            {!isHumanTurn && (
              <p style={{ color: "#9c27b0", fontWeight: "bold", margin: "0.5rem 0" }}>
                🤖 AI is thinking...
              </p>
            )}

            <DiceRow
              dice={game.dice}
              held={game.held}
              onToggleHold={handleToggleHold}
              disabled={!isHumanTurn || game.rollsLeft === 0}
            />
            <button
              onClick={handleRoll}
              disabled={!isHumanTurn || game.rollsLeft <= 0}
              style={{
                marginTop: "1rem",
                padding: "0.75rem 2rem",
                fontSize: "1.1rem",
                fontWeight: "bold",
                borderRadius: "8px",
                border: "none",
                background: isHumanTurn && game.rollsLeft > 0 ? "#2196f3" : "#ccc",
                color: "#fff",
                cursor: isHumanTurn && game.rollsLeft > 0 ? "pointer" : "default",
              }}
            >
              {game.rollsLeft === game.maxRolls ? "Roll Dice" : `Re-roll (${game.rollsLeft})`}
            </button>
          </div>

          <Scorecard
            player={game.players[game.currentPlayerIndex]}
            currentDice={game.dice}
            availableCategories={isHumanTurn ? getAvailableCategories(game.players[game.currentPlayerIndex], game.diceCount) : []}
            onSelectCategory={handleSelectCategory}
            isCurrentPlayer={!!isHumanTurn}
            hasRolled={game.rollsLeft < game.maxRolls}
            diceCount={game.diceCount}
          />
        </div>
      )}

      {screen === "finished" && game && (
        <div style={{ textAlign: "center" }}>
          <h2>Game Over!</h2>
          {game.players
            .slice()
            .sort((a, b) => calculateTotal(b, game.diceCount).grandTotal - calculateTotal(a, game.diceCount).grandTotal)
            .map((p, i) => (
              <p key={p.id} style={{ fontSize: i === 0 ? "1.5rem" : "1.1rem", margin: "0.5rem 0" }}>
                {i === 0 ? "🏆 " : `${i + 1}. `}
                <strong>{p.name}</strong>{p.isAi ? " 🤖" : ""}:{" "}
                {calculateTotal(p, game.diceCount).grandTotal} pts
              </p>
            ))}
          <button
            onClick={handleCancelGame}
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
