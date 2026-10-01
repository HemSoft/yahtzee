import React, { useState } from "react";
import { FlatList, View } from "react-native";
import { useLocalGame } from "../local/LocalProvider";
import { MODES } from "../local/save";
import { Label, styles } from "../ui/controls";
import { Choice } from "../ui/Choice";
import { HighScores } from "./Results";

export function History() {
  const { view, colors } = useLocalGame();
  const [selection, setSelection] = useState<number | null>(null);
  if (!view.data) return <Label>Load saved data from the play screen first.</Label>;
  const diceCount = selection ?? view.data.preferences.diceCount;
  const entries = [...view.data.history.entries].reverse().filter((entry) => entry.diceCount === diceCount);
  return <FlatList style={{ backgroundColor: colors.page }} contentContainerStyle={styles.scroll} data={entries} keyExtractor={(entry) => entry.id}
    ListHeaderComponent={<View>
      <Label muted>The last 500 completed games and all-time top ten per mode stay on this device.</Label>
      <Choice title="Dice count" options={MODES.map((count) => `${count} dice`)} selected={MODES.findIndex((count) => count === diceCount)} onSelect={(index) => setSelection(MODES[index])} />
      <HighScores diceCount={diceCount} />
      <Label kind="heading" accessibilityRole="header" style={{ marginTop: 28 }}>Recent games</Label>
    </View>}
    ListEmptyComponent={<Label>No completed games in this mode yet.</Label>}
    renderItem={({ item }) => <View style={[styles.row, { borderBottomWidth: 0.5, borderBottomColor: colors.line }]}>
      <Label>{new Date(item.completedAt).toLocaleString()}</Label>
      {item.players.map((player, index) => <Label key={index} kind="caption">{player.name}{player.isAi ? " · AI" : ""}: {player.score} pts</Label>)}
    </View>} />;
}
