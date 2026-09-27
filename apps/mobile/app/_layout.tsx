import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LocalProvider, useLocalGame } from "../src/local/LocalProvider";

function Navigation() {
  const { colors, dark } = useLocalGame();
  return <>
    <StatusBar style={dark ? "light" : "dark"} />
    <Stack screenOptions={{ headerLargeTitle: true, headerStyle: { backgroundColor: colors.page }, headerTintColor: colors.text,
      contentStyle: { backgroundColor: colors.page }, freezeOnBlur: true }}>
      <Stack.Screen name="index" options={{ title: "Yahtzee" }} />
      <Stack.Screen name="history" options={{ title: "Local history" }} />
      <Stack.Screen name="help" options={{ title: "Help", presentation: "modal" }} />
    </Stack>
  </>;
}
export default function Layout() {
  return <LocalProvider><Navigation /></LocalProvider>;
}
