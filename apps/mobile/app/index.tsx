import React from "react";
import { useRouter } from "expo-router";
import { NativeGameScreen } from "../src/screens/NativeGameScreen";

export default function Index() {
  const router = useRouter();
  return <NativeGameScreen onHistory={() => router.push("/history")} onHelp={() => router.push("/help")} />;
}
