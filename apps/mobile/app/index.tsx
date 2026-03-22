import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
} from "react-native";
import {
  createGame,
  rollDice,
  reroll,
  getAvailableCategories,
  isGameComplete,
  calculateTotal,
  executeAiTurn,
  pickAiCategory,
  getCategories,
  type GameState,
  type CategoryId,
} from "@yahtzee/game-engine";

const DIE_FACES: Record<number, string> = {
  1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅",
};

const AI_NAMES = ["Bot Alpha", "Bot Beta", "Bot Gamma"];

type Screen = "setup" | "playing" | "finished";

export default function Index() {
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
    const g = createGame({ id: `${Date.now()}`, diceCount, players });
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

  if (screen === "setup") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🎲 Yahtzee</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          value={playerName}
          onChangeText={setPlayerName}
          maxLength={20}
        />
        <Text style={styles.label}>AI Opponents</Text>
        <View style={styles.presetRow}>
          {[0, 1, 2, 3].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.presetBtn, aiOpponents === n && styles.aiPresetActive]}
              onPress={() => setAiOpponents(n)}
            >
              <Text style={aiOpponents === n ? styles.presetTextActive : undefined}>
                {n === 0 ? "Solo" : `${n} AI`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Dice Count</Text>
        <View style={styles.presetRow}>
          {[5, 6, 8, 10].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.presetBtn, diceCount === n && styles.presetBtnActive]}
              onPress={() => setDiceCount(n)}
            >
              <Text style={diceCount === n ? styles.presetTextActive : undefined}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.startBtn, !playerName.trim() && styles.disabledBtn]}
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
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Game Over!</Text>
        {sorted.map((p, i) => (
          <Text key={p.id} style={i === 0 ? styles.finalScore : styles.subtitle}>
            {i === 0 ? "🏆 " : `${i + 1}. `}{p.name}{p.isAi ? " 🤖" : ""}: {calculateTotal(p, game.diceCount).grandTotal} pts
          </Text>
        ))}
        <TouchableOpacity
          style={styles.startBtn}
          onPress={handleCancelGame}
        >
          <Text style={styles.startBtnText}>Play Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!game) return null;

  const available = isHumanTurn ? getAvailableCategories(game.players[game.currentPlayerIndex], game.diceCount) : [];
  const hasRolled = game.rollsLeft < game.maxRolls;
  const suggestedCategory = game && isHumanTurn && hasRolled
    ? pickAiCategory(game.dice, game.players[game.currentPlayerIndex], game.diceCount)
    : undefined;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Quit button */}
      <TouchableOpacity style={styles.quitBtn} onPress={handleCancelGame}>
        <Text style={styles.quitBtnText}>✕ Quit Game</Text>
      </TouchableOpacity>

      <Text style={styles.subtitle}>
        {currentPlayer?.name}'s turn · Round {Math.min(game.currentRound, game.totalRounds)}/{game.totalRounds} · Rolls: {game.rollsLeft}
      </Text>

      {!isHumanTurn && (
        <Text style={styles.aiThinking}>🤖 AI is thinking...</Text>
      )}

      <View style={styles.diceRow}>
        {game.dice.map((val, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.die, game.held.has(i) && styles.dieHeld]}
            onPress={() => isHumanTurn && handleToggleHold(i)}
            disabled={!isHumanTurn}
          >
            <Text style={styles.dieText}>{val > 0 ? DIE_FACES[val] ?? val : "?"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.rollBtn, (!isHumanTurn || game.rollsLeft <= 0) && styles.disabledBtn]}
        onPress={handleRoll}
        disabled={!isHumanTurn || game.rollsLeft <= 0}
      >
        <Text style={styles.rollBtnText}>
          {game.rollsLeft === game.maxRolls ? "Roll Dice" : `Re-roll (${game.rollsLeft})`}
        </Text>
      </TouchableOpacity>

      {/* Multi-player scorecard */}
      <ScrollView horizontal style={{ width: "100%" }}>
        <View>
          {/* Header row */}
          <View style={styles.sheetRow}>
            <View style={styles.catCol}><Text style={{ fontWeight: "bold" }}>Category</Text></View>
            {game.players.map((p, i) => (
              <View key={p.id} style={[styles.playerCol, i === game.currentPlayerIndex && styles.activePlayerCol]}>
                <Text style={{ fontWeight: "bold", textAlign: "center" }}>{p.name}{p.isAi ? " 🤖" : ""}</Text>
              </View>
            ))}
          </View>

          {getCategories(game.diceCount).map((cat) => {
            const isAvailable = available.includes(cat.id) && hasRolled;
            const isSuggested = suggestedCategory === cat.id && isAvailable;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.sheetRow, isAvailable && styles.catRowAvailable, isSuggested && styles.catRowSuggested]}
                onPress={() => isAvailable && handleSelectCategory(cat.id)}
                disabled={!isAvailable}
              >
                <View style={styles.catCol}>
                  <Text style={isSuggested ? { fontWeight: "bold" } : undefined}>
                    {isSuggested ? "⭐ " : ""}{cat.label}
                  </Text>
                </View>
                {game.players.map((p, i) => {
                  const scored = p.scores[cat.id];
                  const showPotential = i === game.currentPlayerIndex && isAvailable;
                  return (
                    <View key={p.id} style={[styles.playerCol, i === game.currentPlayerIndex && styles.activePlayerCol]}>
                      <Text style={[{ textAlign: "center" }, showPotential && scored === undefined ? { color: "#888", fontStyle: "italic" } : undefined]}>
                        {scored !== undefined ? scored : showPotential ? cat.score(game.dice) : "—"}
                      </Text>
                    </View>
                  );
                })}
              </TouchableOpacity>
            );
          })}

          {/* Grand total row */}
          <View style={[styles.sheetRow, { backgroundColor: "#e8e8e8" }]}>
            <View style={styles.catCol}><Text style={{ fontWeight: "bold" }}>Grand Total</Text></View>
            {game.players.map((p, i) => (
              <View key={p.id} style={styles.playerCol}>
                <Text style={{ fontWeight: "bold", textAlign: "center" }}>{calculateTotal(p, game.diceCount).grandTotal}</Text>
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
  subtitle: { fontSize: 16, color: "#666", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, width: "100%", fontSize: 16, marginBottom: 16 },
  label: { fontWeight: "bold", marginBottom: 8 },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" },
  presetBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: "#ddd" },
  presetBtnActive: { borderColor: "#2196f3", backgroundColor: "#e3f2fd" },
  aiPresetActive: { borderColor: "#9c27b0", backgroundColor: "#f3e5f5" },
  presetTextActive: { fontWeight: "bold" },
  startBtn: { backgroundColor: "#4caf50", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  startBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  disabledBtn: { opacity: 0.5 },
  quitBtn: { alignSelf: "flex-end", borderWidth: 1, borderColor: "#e57373", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  quitBtnText: { color: "#c62828", fontSize: 14 },
  aiThinking: { color: "#9c27b0", fontWeight: "bold", marginBottom: 8 },
  diceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 },
  die: { width: 56, height: 56, borderRadius: 10, borderWidth: 2, borderColor: "transparent", backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" },
  dieHeld: { borderColor: "#2e7d32", backgroundColor: "#e8f5e9" },
  dieText: { fontSize: 28 },
  rollBtn: { backgroundColor: "#2196f3", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8, marginBottom: 20 },
  rollBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  catRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  catRowAvailable: { backgroundColor: "#fffde7" },
  catRowSuggested: { backgroundColor: "#c8e6c9" },
  sheetRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd" },
  catCol: { width: 140, paddingVertical: 8, paddingHorizontal: 8 },
  playerCol: { width: 80, paddingVertical: 8, paddingHorizontal: 4 },
  activePlayerCol: { backgroundColor: "rgba(33,150,243,0.06)" },
  finalScore: { fontSize: 28, fontWeight: "bold", marginVertical: 8 },
});
