// Isolated browser fixture: real shared UI, deterministic dice, no backend.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Scorecard } from "../src/Scorecard";
import { ThemeProvider, darkTheme, lightTheme } from "../src/theme";
import { getAvailableCategories, getCategories, type PlayerState, type CategoryId } from "@yahtzee/game-engine";

function Fixture() {
  const [player, setPlayer] = useState<PlayerState>({ id: "test", name: "Keyboard player", scores: {} });
  const [rolled, setRolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [selections, setSelections] = useState(0);
  const dice = [1, 2, 3, 4, 5];
  const theme = dark ? darkTheme : lightTheme;
  function select(id: CategoryId) {
    if (!rolled || player.scores[id] !== undefined) throw new Error("Unavailable category selected");
    setPlayer({ ...player, scores: { ...player.scores, [id]: getCategories(5).find((c) => c.id === id)!.score(dice) } });
    setSelections((n) => n + 1);
  }
  return <ThemeProvider value={theme}>
    <main style={{ background: theme.bg, color: theme.text, minHeight: "100vh", padding: 16 }}>
      <h1>Scorecard keyboard regression fixture</h1>
      <button onClick={() => setRolled(true)}>Roll test dice</button>
      <button onClick={() => setDark(!dark)}>Toggle theme</button>
      <p role="status">Selections: {selections}</p>
      <Scorecard players={[player]} currentPlayerIndex={0} currentDice={dice}
        availableCategories={getAvailableCategories(player)} onSelectCategory={select}
        canInteract hasRolled={rolled} />
    </main>
  </ThemeProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
