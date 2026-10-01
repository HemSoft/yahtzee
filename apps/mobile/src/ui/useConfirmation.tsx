import React, { useState } from "react";
import { Modal, View } from "react-native";
import { useLocalGame } from "../local/LocalProvider";
import { Action, Label } from "./controls";
import { showConfirmation } from "./confirmation";

type Question = { title: string; message: string; accept: () => void };
export type Confirm = (title: string, message: string, accept: () => void) => void;
export function useConfirmation(): { confirm: Confirm; dialog: React.ReactNode } {
  const [question, setQuestion] = useState<Question | null>(null);
  const { colors } = useLocalGame();
  const confirm: Confirm = (title, message, accept) => {
    if (!showConfirmation(title, message, accept)) setQuestion({ title, message, accept });
  };
  const accept = () => { question?.accept(); setQuestion(null); };
  const dialog = <Modal visible={question !== null} transparent animationType="none" onRequestClose={() => setQuestion(null)}>
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#00000066" }}>
      <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 440, padding: 24, borderRadius: 14, gap: 16, backgroundColor: colors.surface }}>
        <Label kind="heading" accessibilityRole="header">{question?.title}</Label>
        <Label>{question?.message}</Label>
        <Action label={question?.title ?? "Confirm"} destructive onPress={accept} />
        <Action label="Cancel" onPress={() => setQuestion(null)} />
      </View>
    </View>
  </Modal>;
  return { confirm, dialog };
}
