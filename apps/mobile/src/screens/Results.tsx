import React from "react";
import { ScrollView, View } from "react-native";
import { calculateTotal, getHighScoresForDiceCount, getPlayerAverageScore } from "@yahtzee/game-engine";
import { useLocalGame } from "../local/LocalProvider";
import { Action, Label, Section, styles } from "../ui/controls";

export function HighScores({ diceCount }: { diceCount: number }) {
  const { view } = useLocalGame();
  const scores = getHighScoresForDiceCount(view.data!.highScores, diceCount);
  return <Section title={`High Scores (${diceCount} dice)`}>
    <View style={styles.row}><Label kind="caption" muted>Local results on this device, not an online leaderboard.</Label></View>
    {scores.length ? scores.map((score) => <View key={`${score.gameId}-${score.playerName}-${score.isAi}`} style={styles.row}>
      <Label>{score.rankCurrent}. {score.playerName}{score.isAi ? " · AI" : ""}</Label>
      <Label style={{ fontWeight: "600", fontVariant: ["tabular-nums"] }}>{score.score} pts</Label>
      <Label kind="caption" muted>{new Date(score.dateRecorded).toLocaleDateString()}</Label>
    </View>) : <View style={styles.row}><Label>No completed games in this mode yet.</Label></View>}
  </Section>;
}
export function Results({ onAgain }: { onAgain: () => void }) {
  const { view } = useLocalGame();
  const data = view.data!, game = data.active!.game;
  const results = game.players.map((player) => ({ player, total: calculateTotal(player, game.diceCount).grandTotal })).sort((a, b) => b.total - a.total);
  return <ScrollView contentContainerStyle={styles.scroll}>
    <Label kind="title" accessibilityRole="header">Game Over!</Label>
    <Label muted>Your results are saved on this device.</Label>
    <Section title="Final scores">
      {results.map(({ player, total }) => <View key={player.id} style={styles.row}>
        <Label kind="heading">{1 + results.filter((other) => other.total > total).length}. {player.name}{player.isAi ? " · AI" : ""}</Label>
        <Label style={{ fontVariant: ["tabular-nums"] }}>{total} pts</Label>
        <Label kind="caption" muted>Name-based average: {getPlayerAverageScore(data.history, player.name, game.diceCount)} pts</Label>
      </View>)}
    </Section>
    <Action label="Play Again" primary disabled={view.busy || view.canRetry} onPress={onAgain} />
    <HighScores diceCount={game.diceCount} />
  </ScrollView>;
}
