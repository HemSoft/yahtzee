import React, { useState, useCallback } from "react";
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
  CATEGORIES,
  type GameState,
  type CategoryId,
} from "@yahtzee/game-engine";

const DIE_FACES: Record<number, string> = {
  1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅",
};

type Screen = "setup" | "playing" | "finished";

export default function Index() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [playerName, setPlayerName] = useState("");
  const [diceCount, setDiceCount] = useState(5);
  const [game, setGame] = useState<GameState | null>(null);

  const handleStartGame = useCallback(() => {
    const g = createGame({
      id: `${Date.now()}`,
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
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Game Over!</Text>
        <Text style={styles.finalScore}>
          {calculateTotal(game.players[0]).grandTotal}
        </Text>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => { setScreen("setup"); setGame(null); }}
        >
          <Text style={styles.startBtnText}>Play Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!game) return null;

  const available = getAvailableCategories(game.players[0]);
  const hasRolled = game.rollsLeft < game.maxRolls;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>
        Round {Math.min(game.currentRound, game.totalRounds)}/{game.totalRounds} · Rolls: {game.rollsLeft}
      </Text>

      <View style={styles.diceRow}>
        {game.dice.map((val, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.die, game.held.has(i) && styles.dieHeld]}
            onPress={() => handleToggleHold(i)}
          >
            <Text style={styles.dieText}>{val > 0 ? DIE_FACES[val] ?? val : "?"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.rollBtn, game.rollsLeft <= 0 && styles.disabledBtn]}
        onPress={handleRoll}
        disabled={game.rollsLeft <= 0}
      >
        <Text style={styles.rollBtnText}>
          {game.rollsLeft === game.maxRolls ? "Roll Dice" : `Re-roll (${game.rollsLeft})`}
        </Text>
      </TouchableOpacity>

      {CATEGORIES.map((cat) => {
        const scored = game.players[0].scores[cat.id];
        const isAvailable = available.includes(cat.id) && hasRolled;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catRow, isAvailable && styles.catRowAvailable]}
            onPress={() => isAvailable && handleSelectCategory(cat.id)}
            disabled={!isAvailable}
          >
            <Text>{cat.label}</Text>
            <Text>
              {scored !== undefined
                ? scored
                : isAvailable
                  ? cat.score(game.dice)
                  : "—"}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: "center", paddingTop: 60 },
  title: { fontSize: 32, fontWeight: "bold", marginBottom: 20 },
  subtitle: { fontSize: 16, color: "#666", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, width: "100%", fontSize: 16, marginBottom: 16 },
  label: { fontWeight: "bold", marginBottom: 8 },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  presetBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: "#ddd" },
  presetBtnActive: { borderColor: "#2196f3", backgroundColor: "#e3f2fd" },
  presetTextActive: { fontWeight: "bold" },
  startBtn: { backgroundColor: "#4caf50", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  startBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  disabledBtn: { opacity: 0.5 },
  diceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 },
  die: { width: 56, height: 56, borderRadius: 10, borderWidth: 2, borderColor: "transparent", backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" },
  dieHeld: { borderColor: "#2e7d32", backgroundColor: "#e8f5e9" },
  dieText: { fontSize: 28 },
  rollBtn: { backgroundColor: "#2196f3", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8, marginBottom: 20 },
  rollBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  catRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  catRowAvailable: { backgroundColor: "#fffde7" },
  finalScore: { fontSize: 48, fontWeight: "bold", marginVertical: 20 },
});
