import React from "react";
import { Stack } from "expo-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) throw new Error("Missing EXPO_PUBLIC_CONVEX_URL environment variable");
const convex = new ConvexReactClient(url);

export default function Layout() {
  return (
    <ConvexProvider client={convex}>
      <Stack screenOptions={{ headerShown: false }} />
    </ConvexProvider>
  );
}
