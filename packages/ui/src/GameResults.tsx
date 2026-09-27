import React from "react";
import { calculateTotal, type GameState } from "@yahtzee/game-engine";
import { Icon } from "./Icons";

export interface HighScore {
  _id: string;
  gameId: string;
  playerName: string;
  isAi: boolean;
  score: number;
  rankCurrent: number;
  dateRecorded: string;
}
export interface HistoryEntry { diceCount: number; players: { name: string; score: number }[] }

function HighScores({ diceCount, scores, offline }: { diceCount: number; scores: HighScore[] | undefined; offline: boolean }) {
  return <section className="leaderboard-panel"><div className="leaderboard-title"><Icon name="trophy" /><h2>High Scores ({diceCount} dice)</h2></div>
    {scores === undefined ? <p role="status" className="empty-scores">Loading high scores...</p> : scores.length === 0 ? <p className="empty-scores">No high scores yet for this dice count.</p> : <div className="leaderboard-scroll"><table><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Score</th><th scope="col">Date</th></tr></thead><tbody>
      {scores.map((entry) => <tr key={entry._id}><td className="leaderboard-rank">{entry.rankCurrent.toString().padStart(2, "0")}</td><td>{entry.playerName}{entry.isAi && <span className="ai-label">AI</span>}</td><td className="leaderboard-score">{entry.score}</td><td className="leaderboard-date">{new Date(entry.dateRecorded).toLocaleDateString()}</td></tr>)}
    </tbody></table></div>}
    <p className="leaderboard-footnote">{offline ? "Local scores · Saved on this PC" : "Verified scores · Ranked by dice count"}</p>
  </section>;
}

export function GameResults({ game, history, highScores, onPlayAgain, offline = false }: { game: GameState; history: HistoryEntry[] | undefined; highScores: HighScore[] | undefined; onPlayAgain: () => void; offline?: boolean }) {
  return <div className="results-layout">
    <section className="results-deck"><Icon name="trophy" size={44} /><h2>Game Over!</h2><p>Every choice adds up. Here's how it landed.</p>
      <ol className="final-standings">{game.players.slice().sort((a, b) => calculateTotal(b, game.diceCount).grandTotal - calculateTotal(a, game.diceCount).grandTotal).map((entry, index) => {
        const scores = (history ?? []).filter((record) => record.diceCount === game.diceCount).flatMap((record) => record.players).filter((record) => record.name === entry.name);
        const average = scores.length ? Math.round(scores.reduce((sum, record) => sum + record.score, 0) / scores.length) : 0;
        return <li key={entry.id}><span className="finish-place">{index + 1}</span><div><strong>{entry.name}</strong><span>{entry.isAi ? "AI · " : ""}avg: {average}</span></div><strong className="finish-score">{calculateTotal(entry, game.diceCount).grandTotal}<small> pts</small></strong></li>;
      })}</ol>
      <button type="button" className="button roll-button" onClick={onPlayAgain}>Play Again <Icon name="arrow" /></button>
    </section>
    <HighScores diceCount={game.diceCount} scores={highScores} offline={offline} />
  </div>;
}
