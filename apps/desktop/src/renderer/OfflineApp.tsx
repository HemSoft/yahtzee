import React, { useState } from "react";
import { createOfflineBackend, getHighScoresForDiceCount } from "@yahtzee/game-engine";
import { useGameSession } from "@yahtzee/ui";
import { GameApp } from "@yahtzee/ui/src/GameApp";

export function OfflineApp() {
  const [diceCount, setDiceCount] = useState(6);
  const [backend] = useState(() => createOfflineBackend(localStorage));
  const session = useGameSession(backend, {
    startError: "Could not open your local scores. Check that this PC has free disk space and that your saved data is readable, then reopen the app.",
    moveError: "Could not save this move on your PC. Free some disk space, then choose Retry move. Keep this window open so your game is not lost.",
  });
  const records = backend.results();
  const highScores = getHighScoresForDiceCount(records.highScores, diceCount)
    .map((entry, index) => ({ ...entry, _id: `${entry.gameId}-${index}` }));
  return <GameApp desktop offline session={session} diceCount={diceCount} onDiceCountChange={setDiceCount}
    highScores={highScores} history={records.history.entries} />;
}
