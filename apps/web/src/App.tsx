import React, { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useGameSession } from "@yahtzee/ui";
import { GameApp } from "../../../packages/ui/src/GameApp";

export function App() {
  const [diceCount, setDiceCount] = useState(5);
  const start = useAction(api.gameSessions.start);
  const move = useMutation(api.games.move);
  const session = useGameSession({ start, move });
  const history = useQuery(api.gameLogs.list, {});
  const highScores = useQuery(api.highScores.top, { diceCount: session.game?.diceCount ?? diceCount });
  return <GameApp session={session} diceCount={diceCount} onDiceCountChange={setDiceCount} highScores={highScores} history={history} />;
}
