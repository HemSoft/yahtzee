import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalGame } from "../local/LocalProvider";
import { Label } from "../ui/controls";

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function Dice() {
  const { store, view, colors } = useLocalGame();
  const game = view.data!.active!.game;
  const disabled = view.busy || view.canRetry || game.rollsLeft === 0;
  return <View style={styles.hand}>
    {game.dice.map((value, index) => {
      const held = game.held.includes(index);
      return <Pressable key={index} testID={`die-${index}`} accessibilityRole="checkbox"
        accessibilityLabel={`Die ${index + 1}, showing ${value}`} aria-valuetext={held ? "Held" : "Not held"}
        aria-checked={held} aria-disabled={disabled} disabled={disabled}
        onPress={() => { void store.move({ kind: "hold", index }); }} style={styles.control}>
        <View accessible={false} style={[styles.face, { backgroundColor: held ? colors.held : colors.die }]}>
          {PIPS[value].map((position) => <View key={position} accessible={false}
            style={[styles.pip, { backgroundColor: colors.pip, left: 10 + position % 3 * 14, top: 10 + Math.floor(position / 3) * 14 }]} />)}
        </View>
        <Label kind="caption" color={colors.deckText} style={styles.hold}>{held ? "Held" : "Hold"}</Label>
      </Pressable>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  hand: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, paddingVertical: 12 },
  control: { minWidth: 52, minHeight: 80, alignItems: "center", gap: 6 },
  face: { width: 56, height: 56, borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 7 },
  pip: { position: "absolute", width: 8, height: 8, borderRadius: 4 },
  hold: { textAlign: "center" },
});
