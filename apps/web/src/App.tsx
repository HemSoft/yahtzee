import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  getAvailableCategories,
  calculateTotal,
  pickAiCategory,
  createEmptyGameLog,
  type GameLog,
  type GameLogEntry,
} from "@yahtzee/game-engine";
import { DiceRow, Scorecard, GameSettings, ThemeToggle, ThemeProvider, lightTheme, darkTheme, useGameSession } from "@yahtzee/ui";

function loadThemeMode(): "light" | "dark" {
  try {
    const saved = localStorage.getItem("yahtzee-theme");
    return saved === "dark" ? "dark" : "light";
  } catch { return "light"; }
}

function loadRecentNames(): string[] {
  try {
    const raw = localStorage.getItem("yahtzee-recent-names");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveRecentName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const prev = loadRecentNames().filter((n) => n !== trimmed);
  const updated = [trimmed, ...prev].slice(0, 5);
  localStorage.setItem("yahtzee-recent-names", JSON.stringify(updated));
  return updated;
}

type Screen = "setup" | "playing" | "finished";

export function App() {
  const [screenState, setScreen] = useState<Screen>("setup");
  const [playerName, setPlayerName] = useState(() => loadRecentNames()[0] ?? "");
  const [recentNames, setRecentNames] = useState(loadRecentNames);
  const [diceCount, setDiceCount] = useState(5);
  const [aiOpponents, setAiOpponents] = useState(0);
  const startGuest = useAction(api.gameSessions.start);
  const moveGuest = useMutation(api.games.move);
  const { game, busy, error, canRetry, retry, start, reset,
    roll: handleRoll, toggleHold: handleToggleHold, selectCategory: handleSelectCategory,
  } = useGameSession({ start: startGuest, move: moveGuest });
  const screen = screenState === "playing" && game?.status === "finished" ? "finished" : screenState;
  const [themeMode, setThemeMode] = useState<"light" | "dark">(loadThemeMode);
  const theme = themeMode === "dark" ? darkTheme : lightTheme;

  // Convex queries
  const allGameLogs = useQuery(api.gameLogs.list, {});
  const activeDiceCount = game?.diceCount ?? diceCount;
  const topScoresRaw = useQuery(api.highScores.top, { diceCount: activeDiceCount });

  // Build a GameLog object from Convex data for average score calculations
  const gameLog: GameLog = useMemo(() => {
    if (!allGameLogs) return createEmptyGameLog();
    return {
      entries: allGameLogs.map((e): GameLogEntry => ({
        id: e.gameId,
        diceCount: e.diceCount,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        durationSeconds: e.durationSeconds,
        players: e.players,
        winnerName: e.winnerName,
      })),
    };
  }, [allGameLogs]);

  // Derive leaderboard scores from Convex query
  const leaderboardScores = useMemo(
    () => (topScoresRaw ?? []).map((e) => e.score),
    [topScoresRaw]
  );


  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("yahtzee-theme", next);
      return next;
    });
  }, []);


  const handleStartGame = useCallback(async () => {
    const name = playerName.trim();
    if (await start({ name, diceCount, aiOpponents })) {
      setScreen("playing");
      try {
        const updated = saveRecentName(name);
        if (updated) setRecentNames(updated);
      } catch { /* Name history is optional; the authorized game is already active. */ }
    }
  }, [playerName, diceCount, aiOpponents, start]);

  const handleCancelGame = useCallback(() => {
    reset(); setScreen("setup");
  }, [reset]);

  const currentPlayer = game?.players[game.currentPlayerIndex];
  const isHumanTurn = currentPlayer && !currentPlayer.isAi;
  const canInteract = !!isHumanTurn && !busy && !canRetry;
  const hasRolled = game ? game.rollsLeft < game.maxRolls : false;
  const suggestedCategory = game && isHumanTurn && hasRolled
    ? pickAiCategory(game.dice, game.players[game.currentPlayerIndex], game.diceCount)
    : undefined;

  return (
    <ThemeProvider value={theme}>
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 2rem 3rem", background: theme.bg, color: theme.text, minHeight: "100vh" }}>
      <ThemeToggle onToggle={toggleTheme} />
      <h1 style={{ textAlign: "center", marginBottom: "1.5rem", color: theme.text }}>🎲 Yahtzee</h1>

      {busy && <p role="status">{game ? "Saving move..." : "Starting guest game..."}</p>}
      {error && <div role="alert"><p>{error}</p>{canRetry && <button onClick={retry} disabled={busy}>Retry move</button>}</div>}

      {screen === "setup" && (
        <fieldset disabled={busy} style={{ display: "flex", justifyContent: "center", border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <GameSettings
            diceCount={diceCount}
            onDiceCountChange={setDiceCount}
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            aiOpponents={aiOpponents}
            onAiOpponentsChange={setAiOpponents}
            onStartGame={handleStartGame}
            recentNames={recentNames}
          />
        </fieldset>
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
                background: theme.surface,
                color: "#c62828",
                cursor: "pointer",
              }}
            >
              ✕ Quit Game
            </button>
          </div>

          <div style={{ textAlign: "center" }}>
            <p style={{ marginBottom: "0.5rem", color: theme.textMuted }}>
              {currentPlayer?.name}'s turn &nbsp;·&nbsp;
              Round {Math.min(game.currentRound, game.totalRounds)} / {game.totalRounds}
              &nbsp;·&nbsp;Rolls left: {game.rollsLeft}
            </p>

            {!isHumanTurn && (
              <p style={{ color: theme.accent, fontWeight: "bold", margin: "0.5rem 0" }}>
                🤖 AI is thinking...
              </p>
            )}

            <DiceRow
              dice={game.dice}
              held={game.held}
              onToggleHold={handleToggleHold}
              disabled={!canInteract || game.rollsLeft === 0}
            />
            <button
              onClick={handleRoll}
              disabled={!canInteract || game.rollsLeft <= 0}
              style={{
                marginTop: "1rem",
                padding: "0.75rem 2rem",
                fontSize: "1.1rem",
                fontWeight: "bold",
                borderRadius: "8px",
                border: "none",
                background: canInteract && game.rollsLeft > 0 ? theme.primary : theme.disabledBg,
                color: "#fff",
                cursor: canInteract && game.rollsLeft > 0 ? "pointer" : "default",
              }}
            >
              {game.rollsLeft === game.maxRolls ? "Roll Dice" : `Re-roll (${game.rollsLeft})`}
            </button>
          </div>

          <Scorecard
            players={game.players}
            currentPlayerIndex={game.currentPlayerIndex}
            currentDice={game.dice}
            availableCategories={isHumanTurn ? getAvailableCategories(game.players[game.currentPlayerIndex], game.diceCount) : []}
            onSelectCategory={handleSelectCategory}
            canInteract={canInteract}
            hasRolled={game.rollsLeft < game.maxRolls}
            diceCount={game.diceCount}
            suggestedCategory={suggestedCategory}
            leaderboardScores={leaderboardScores}
          />
        </div>
      )}

      {screen === "finished" && game && (() => {
        const topScores = topScoresRaw ?? [];
        return (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: theme.text }}>Game Over!</h2>
          {game.players
            .slice()
            .sort((a, b) => calculateTotal(b, game.diceCount).grandTotal - calculateTotal(a, game.diceCount).grandTotal)
            .map((p, i) => {
              // Compute average from Convex game logs
              const matching = gameLog.entries
                .filter((e) => e.diceCount === game.diceCount)
                .flatMap((e) => e.players)
                .filter((pl) => pl.name === p.name);
              const avg = matching.length === 0 ? 0 : Math.round(matching.reduce((sum, pl) => sum + pl.score, 0) / matching.length);
              return (
              <p key={p.id} style={{ fontSize: i === 0 ? "1.5rem" : "1.1rem", margin: "0.5rem 0", color: theme.text }}>
                {i === 0 ? "🏆 " : `${i + 1}. `}
                <strong>{p.name}</strong>{p.isAi ? " 🤖" : ""}:{" "}
                {calculateTotal(p, game.diceCount).grandTotal} pts
                <span style={{ fontSize: "0.8rem", color: theme.textMuted, marginLeft: "0.5rem" }}>
                  (avg: {avg})
                </span>
              </p>
              );
            })}
          <button
            onClick={handleCancelGame}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 2rem",
              fontSize: "1.1rem",
              fontWeight: "bold",
              borderRadius: "8px",
              border: "none",
              background: theme.success,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Play Again
          </button>

          {topScores.length > 0 && (
            <div style={{ marginTop: "2rem" }}>
              <h3 style={{ color: theme.text }}>🏅 High Scores ({game.diceCount} dice)</h3>
              <table style={{ margin: "0 auto", borderCollapse: "collapse", minWidth: "350px" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${theme.borderStrong}` }}>
                    <th style={{ padding: "0.4rem 1rem", textAlign: "center", color: theme.text }}>#</th>
                    <th style={{ padding: "0.4rem 1rem", textAlign: "left", color: theme.text }}>Player</th>
                    <th style={{ padding: "0.4rem 1rem", textAlign: "right", color: theme.text }}>Score</th>
                    <th style={{ padding: "0.4rem 1rem", textAlign: "right", color: theme.text }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {topScores.map((hs) => (
                    <tr key={`${hs.gameId}-${hs.playerName}-${hs._id}`} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: "0.3rem 1rem", textAlign: "center", color: theme.text }}>{hs.rankCurrent}</td>
                      <td style={{ padding: "0.3rem 1rem", color: theme.text }}>
                        {hs.playerName}{hs.isAi ? " 🤖" : ""}
                      </td>
                      <td style={{ padding: "0.3rem 1rem", textAlign: "right", fontWeight: "bold", color: theme.text }}>{hs.score}</td>
                      <td style={{ padding: "0.3rem 1rem", textAlign: "right", fontSize: "0.85rem", color: theme.textMuted }}>
                        {new Date(hs.dateRecorded).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        );
      })()}
    </div>
    </ThemeProvider>
  );
}
