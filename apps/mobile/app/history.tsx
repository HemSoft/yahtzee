import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalGame } from "../src/local/LocalProvider";
import { History } from "../src/screens/History";

export default function HistoryRoute() {
  const { colors } = useLocalGame();
  return <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1, backgroundColor: colors.page }}><History /></SafeAreaView>;
}
