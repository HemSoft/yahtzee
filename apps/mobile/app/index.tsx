import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  createGame,
  rollDice,
  reroll,
  getAvailableCategories,
  isGameComplete,
  calculateTotal,
  calculateMaxPossibleScore,
  executeAiTurn,
  pickAiCategory,
  getCategories,
  createEmptyGameLog,
  type GameState,
  type CategoryId,
  type GameLog,
  type GameLogEntry,
} from "@yahtzee/game-engine";
import { lightTheme, darkTheme, type Theme } from "@yahtzee/ui";

const DIE_FACES: Record<number, string> = {
  1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅",
};

const AI_NAMES = ["Bot Alpha", "Bot Beta", "Bot Gamma"];

type Screen = "setup" | "playing" | "finished";

export default function Index() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [playerName, setPlayerName] = useState("");
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [diceCount, setDiceCount] = useState(5);
  const [aiOpponents, setAiOpponents] = useState(0);
  const [game, setGame] = useState<GameState | null>(null);
  const gameStartedAt = useRef<string>("");
  const lastLoggedGameRef = useRef<string>("");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const theme = themeMode === "dark" ? darkTheme : lightTheme;

  useEffect(() => {
    AsyncStorage.getItem("yahtzee-recent-names").then((raw) => {
      if (raw) {
        const names = JSON.parse(raw) as string[];
        setRecentNames(names);
        if (names.length > 0) setPlayerName(names[0]);
      }
    }).catch(() => {});
  }, []);

  // Convex queries
  const allGameLogs = useQuery(api.gameLogs.list, {});
  const activeDiceCount = game?.diceCount ?? diceCount;
  const topScoresRaw = useQuery(api.highScores.top, { diceCount: activeDiceCount });

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

  const highScoresForDice = useMemo(
    () => (topScoresRaw ?? []),
    [topScoresRaw]
  );

  // Convex mutations
  const addGameLog = useMutation(api.gameLogs.add);
  const submitHighScore = useMutation(api.highScores.submit);

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      AsyncStorage.setItem("yahtzee-theme", next).catch(() => {});
      return next;
    });
  }, []);

  // Load theme preference on mount (theme stays local)
  useEffect(() => {
    (async () => {
      try {
        const themeRaw = await AsyncStorage.getItem("yahtzee-theme");
        if (themeRaw === "dark") setThemeMode("dark");
      } catch {}
    })();
  }, []);

  const handleGameFinished = useCallback((finishedGame: GameState) => {
    if (lastLoggedGameRef.current === finishedGame.id) return;
    lastLoggedGameRef.current = finishedGame.id;

    const completedAt = new Date().toISOString();
    const startDate = new Date(gameStartedAt.current);
    const endDate = new Date(completedAt);
    const durationSeconds = Math.round((endDate.getTime() - startDate.getTime()) / 1000);

    const players = finishedGame.players.map((p) => ({
      name: p.name,
      isAi: !!p.isAi,
      score: calculateTotal(p, finishedGame.diceCount).grandTotal,
      scores: { ...p.scores },
    }));

    const winner = players.reduce((best, p) => (p.score > best.score ? p : best), players[0]);

    addGameLog({
      gameId: finishedGame.id,
      diceCount: finishedGame.diceCount,
      startedAt: gameStartedAt.current,
      completedAt,
      durationSeconds,
      players,
      winnerName: winner.name,
    });

    const now = new Date().toISOString();
    for (const p of players) {
      submitHighScore({
        diceCount: finishedGame.diceCount,
        dateRecorded: now,
        score: p.score,
        playerName: p.name,
        isAi: p.isAi,
        gameId: finishedGame.id,
      });
    }
  }, [addGameLog, submitHighScore]);

  const handleStartGame = useCallback(() => {
    const trimmedName = playerName.trim();
    const updated = [trimmedName, ...recentNames.filter((n) => n !== trimmedName)].slice(0, 5);
    setRecentNames(updated);
    AsyncStorage.setItem("yahtzee-recent-names", JSON.stringify(updated)).catch(() => {});
    const players: { id: string; name: string; isAi?: boolean }[] = [
      { id: "local", name: trimmedName },
    ];
    for (let i = 0; i < aiOpponents; i++) {
      players.push({ id: `ai-${i}`, name: AI_NAMES[i], isAi: true });
    }
    const g = createGame({ id: `${Date.now()}`, diceCount, players });
    g.status = "playing";
    gameStartedAt.current = new Date().toISOString();
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
          handleGameFinished(g);
          return g;
        }
        g = advanceToNextPlayer(g);
        return g;
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [game?.currentPlayerIndex, game?.currentRound, screen, advanceToNextPlayer, handleGameFinished]);

  // Auto-roll dice when advancing to a human player's turn
  useEffect(() => {
    if (!game || screen !== "playing") return;
    const current = game.players[game.currentPlayerIndex];
    if (current.isAi) return;
    if (game.rollsLeft !== game.maxRolls) return;
    if (game.dice.some((d: number) => d !== 0)) return;

    const timeout = setTimeout(() => {
      setGame((prev) => {
        if (!prev) return prev;
        return { ...prev, dice: rollDice(prev.diceCount), rollsLeft: prev.rollsLeft - 1 };
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [game?.currentPlayerIndex, game?.currentRound, screen]);

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
          handleGameFinished(newGame);
          return newGame;
        }

        newGame = advanceToNextPlayer(newGame);
        return newGame;
      });
    },
    [game, advanceToNextPlayer, handleGameFinished]
  );

  const currentPlayer = game?.players[game.currentPlayerIndex];
  const isHumanTurn = currentPlayer && !currentPlayer.isAi;

  if (screen === "setup") {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <TouchableOpacity onPress={toggleTheme} style={{ alignSelf: "flex-end", padding: 8, borderRadius: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ fontSize: 20 }}>{theme.mode === "light" ? "🌙" : "☀️"}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>🎲 Yahtzee</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Your name"
          placeholderTextColor={theme.textMuted}
          value={playerName}
          onChangeText={setPlayerName}
          maxLength={20}
        />
        {recentNames.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {recentNames.map((name) => (
              <TouchableOpacity
                key={name}
                onPress={() => setPlayerName(name)}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: playerName === name ? theme.accent : theme.border, backgroundColor: playerName === name ? theme.accentBg : theme.surface }}
              >
                <Text style={{ color: playerName === name ? theme.accent : theme.textMuted, fontSize: 13 }}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={[styles.label, { color: theme.text }]}>AI Opponents</Text>
        <View style={styles.presetRow}>
          {[0, 1, 2, 3].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.presetBtn, { borderColor: theme.border, backgroundColor: theme.surface }, aiOpponents === n && { borderColor: theme.accent, backgroundColor: theme.accentBg }]}
              onPress={() => setAiOpponents(n)}
            >
              <Text style={{ color: aiOpponents === n ? theme.accent : theme.text, fontWeight: aiOpponents === n ? "bold" : "normal" }}>
                {n === 0 ? "Solo" : `${n} AI`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.label, { color: theme.text }]}>Dice Count</Text>
        <View style={styles.presetRow}>
          {[5, 6, 8, 10].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.presetBtn, { borderColor: theme.border, backgroundColor: theme.surface }, diceCount === n && { borderColor: theme.primary, backgroundColor: theme.primaryBg }]}
              onPress={() => setDiceCount(n)}
            >
              <Text style={{ color: diceCount === n ? theme.primary : theme.text, fontWeight: diceCount === n ? "bold" : "normal" }}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: theme.success }, !playerName.trim() && styles.disabledBtn]}
          onPress={handleStartGame}
          disabled={!playerName.trim()}
        >
          <Text style={styles.startBtnText}>Start Game</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === "finished" && game) {
    const sorted = game.players.slice().sort((a, b) => calculateTotal(b, game.diceCount).grandTotal - calculateTotal(a, game.diceCount).grandTotal);
    const topScores = highScoresForDice;
    return (
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.text }]}>Game Over!</Text>
        {sorted.map((p, i) => {
          const matching = gameLog.entries
            .filter((e) => e.diceCount === game.diceCount)
            .flatMap((e) => e.players)
            .filter((pl) => pl.name === p.name);
          const avg = matching.length === 0 ? 0 : Math.round(matching.reduce((sum, pl) => sum + pl.score, 0) / matching.length);
          return (
          <View key={p.id} style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginBottom: 4 }}>
            <Text style={[i === 0 ? styles.finalScore : styles.subtitle, { color: theme.text }]}>
              {i === 0 ? "🏆 " : `${i + 1}. `}{p.name}{p.isAi ? " 🤖" : ""}: {calculateTotal(p, game.diceCount).grandTotal} pts
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted, marginLeft: 6 }}>
              (avg: {avg})
            </Text>
          </View>
          );
        })}
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: theme.success }]}
          onPress={handleCancelGame}
        >
          <Text style={styles.startBtnText}>Play Again</Text>
        </TouchableOpacity>

        {topScores.length > 0 && (
          <View style={{ marginTop: 24, width: "100%" }}>
            <Text style={[styles.subtitle, { textAlign: "center", marginBottom: 8, color: theme.text }]}>🏅 High Scores ({game.diceCount} dice)</Text>
            <View style={{ borderTopWidth: 2, borderTopColor: theme.borderStrong }}>
              <View style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <Text style={{ flex: 0.5, fontWeight: "bold", textAlign: "center", color: theme.text }}>#</Text>
                <Text style={{ flex: 2, fontWeight: "bold", color: theme.text }}>Player</Text>
                <Text style={{ flex: 1, fontWeight: "bold", textAlign: "right", color: theme.text }}>Score</Text>
                <Text style={{ flex: 1.5, fontWeight: "bold", textAlign: "right", color: theme.text }}>Date</Text>
              </View>
              {topScores.map((hs) => (
                <View key={`${hs.gameId}-${hs.playerName}-${hs._id}`} style={{ flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                  <Text style={{ flex: 0.5, textAlign: "center", color: theme.text }}>{hs.rankCurrent}</Text>
                  <Text style={{ flex: 2, color: theme.text }}>
                    {hs.playerName}{hs.isAi ? " 🤖" : ""}
                  </Text>
                  <Text style={{ flex: 1, textAlign: "right", fontWeight: "bold", color: theme.text }}>{hs.score}</Text>
                  <Text style={{ flex: 1.5, textAlign: "right", fontSize: 12, color: theme.textMuted }}>
                    {new Date(hs.dateRecorded).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  if (!game) return null;

  const available = isHumanTurn ? getAvailableCategories(game.players[game.currentPlayerIndex], game.diceCount) : [];
  const hasRolled = game.rollsLeft < game.maxRolls;
  const suggestedCategory = game && isHumanTurn && hasRolled
    ? pickAiCategory(game.dice, game.players[game.currentPlayerIndex], game.diceCount)
    : undefined;

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Quit button */}
      <TouchableOpacity style={[styles.quitBtn, { borderColor: "#e57373" }]} onPress={handleCancelGame}>
        <Text style={styles.quitBtnText}>✕ Quit Game</Text>
      </TouchableOpacity>

      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        {currentPlayer?.name}'s turn · Round {Math.min(game.currentRound, game.totalRounds)}/{game.totalRounds} · Rolls: {game.rollsLeft}
      </Text>

      {!isHumanTurn && (
        <Text style={[styles.aiThinking, { color: theme.accent }]}>🤖 AI is thinking...</Text>
      )}

      <View style={styles.diceRow}>
        {game.dice.map((val, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.die, { backgroundColor: theme.dieBg, borderColor: "transparent" }, game.held.has(i) && { borderColor: theme.heldBorder, backgroundColor: theme.heldBg }]}
            onPress={() => isHumanTurn && handleToggleHold(i)}
            disabled={!isHumanTurn}
          >
            <Text style={[styles.dieText, { color: theme.text }]}>{val > 0 ? DIE_FACES[val] ?? val : "?"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.rollBtn, { backgroundColor: isHumanTurn && game.rollsLeft > 0 ? theme.primary : theme.disabledBg }, (!isHumanTurn || game.rollsLeft <= 0) && styles.disabledBtn]}
        onPress={handleRoll}
        disabled={!isHumanTurn || game.rollsLeft <= 0}
      >
        <Text style={styles.rollBtnText}>
          {game.rollsLeft === game.maxRolls ? "Roll Dice" : `Re-roll (${game.rollsLeft})`}
        </Text>
      </TouchableOpacity>

      {/* Multi-player scorecard */}
      {available.length > 0 && hasRolled && (
        <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 6 }}>Click any highlighted row to place your score</Text>
      )}
      <ScrollView horizontal style={{ width: "100%" }}>
        <View>
          {/* Header row */}
          {(() => {
            const totals = game.players.map((p) => calculateTotal(p, game.diceCount));
            const scores = totals.map((t) => t.grandTotal);
            const indexed = scores.map((s, i) => ({ i, s })).sort((a, b) => b.s - a.s);
            const ranks = new Array<number>(scores.length);
            let rank = 1;
            for (let j = 0; j < indexed.length; j++) {
              if (j > 0 && indexed[j].s < indexed[j - 1].s) rank = j + 1;
              ranks[indexed[j].i] = rank;
            }
            const lbScores = highScoresForDice.map((e) => e.score);
            const maxScores = game.players.map((p) => calculateMaxPossibleScore(p, game.diceCount));
            const bestLbRanks = maxScores.map((max) => {
              let r = 1;
              for (const s of lbScores) { if (s > max) r++; else break; }
              return r;
            });
            return (
              <View style={[styles.sheetRow, { borderBottomColor: theme.border }]}>
                <View style={styles.catCol}><Text style={{ fontWeight: "bold", color: theme.text }}>Category</Text></View>
                {game.players.map((p, i) => (
                  <View key={p.id} style={[styles.playerCol, i === game.currentPlayerIndex && { backgroundColor: theme.currentPlayerBg }]}>
                    <Text style={{ fontWeight: "bold", textAlign: "center", color: theme.text, fontSize: 15 }}>{totals[i].grandTotal} pts</Text>
                    <Text style={{ textAlign: "center", color: theme.textMuted, fontSize: 10 }}>
                      #{ranks[i]} in game · best: #{bestLbRanks[i]}
                    </Text>
                    <Text style={{ fontWeight: "bold", textAlign: "center", color: theme.text }}>{p.name}{p.isAi ? " 🤖" : ""}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {getCategories(game.diceCount).map((cat) => {
            const isAvailable = available.includes(cat.id) && hasRolled;
            const isSuggested = suggestedCategory === cat.id && isAvailable;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.sheetRow, { borderBottomColor: theme.border }, isAvailable && { backgroundColor: theme.availableBg }, isSuggested && { backgroundColor: theme.suggestionBg }]}
                onPress={() => isAvailable && handleSelectCategory(cat.id)}
                disabled={!isAvailable}
              >
                <View style={[styles.catCol, isAvailable && { borderLeftWidth: 3, borderLeftColor: theme.availableBorder }]}>
                  <Text style={{ fontWeight: isSuggested ? "bold" : "normal", color: theme.text }}>
                    {isSuggested ? "⭐ " : isAvailable ? "► " : ""}{cat.label}
                  </Text>
                </View>
                {game.players.map((p, i) => {
                  const scored = p.scores[cat.id];
                  const showPotential = i === game.currentPlayerIndex && isAvailable;
                  return (
                    <View key={p.id} style={[styles.playerCol, i === game.currentPlayerIndex && { backgroundColor: theme.currentPlayerBg }]}>
                      <Text style={[{ textAlign: "center", color: theme.text }, showPotential && scored === undefined ? { color: theme.scorePotential, fontStyle: "italic" } : undefined]}>
                        {scored !== undefined ? scored : showPotential ? cat.score(game.dice) : "—"}
                      </Text>
                    </View>
                  );
                })}
              </TouchableOpacity>
            );
          })}

          {/* Grand total row */}
          <View style={[styles.sheetRow, { backgroundColor: theme.grandTotalBg }]}>
            <View style={styles.catCol}><Text style={{ fontWeight: "bold", color: theme.text }}>Grand Total</Text></View>
            {game.players.map((p, i) => (
              <View key={p.id} style={styles.playerCol}>
                <Text style={{ fontWeight: "bold", textAlign: "center", color: theme.text }}>{calculateTotal(p, game.diceCount).grandTotal}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: "center", paddingTop: 60 },
  title: { fontSize: 32, fontWeight: "bold", marginBottom: 20 },
  subtitle: { fontSize: 16, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, width: "100%", fontSize: 16, marginBottom: 16 },
  label: { fontWeight: "bold", marginBottom: 8 },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" },
  presetBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 2 },
  startBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  startBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  disabledBtn: { opacity: 0.5 },
  quitBtn: { alignSelf: "flex-end", borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  quitBtnText: { color: "#c62828", fontSize: 14 },
  aiThinking: { fontWeight: "bold", marginBottom: 8 },
  diceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 },
  die: { width: 56, height: 56, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dieText: { fontSize: 28 },
  rollBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8, marginBottom: 20 },
  rollBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  sheetRow: { flexDirection: "row", borderBottomWidth: 1 },
  catCol: { width: 140, paddingVertical: 8, paddingHorizontal: 8 },
  playerCol: { width: 80, paddingVertical: 8, paddingHorizontal: 4 },
  finalScore: { fontSize: 28, fontWeight: "bold", marginVertical: 8 },
});
