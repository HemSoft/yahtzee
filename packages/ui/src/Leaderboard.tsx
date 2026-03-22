import React from "react";

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  score: number;
  diceCount: number;
  date: string;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  title?: string;
}

export function Leaderboard({ entries, title = "Leaderboard" }: LeaderboardProps) {
  return (
    <div>
      <h2>{title}</h2>
      {entries.length === 0 ? (
        <p style={{ color: "#888" }}>No scores yet. Play a game!</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Player</th>
              <th style={thStyle}>Score</th>
              <th style={thStyle}>Dice</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i} style={{ background: i < 3 ? "#fffde7" : "transparent" }}>
                <td style={tdStyle}>
                  {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
                </td>
                <td style={tdStyle}>{entry.playerName}</td>
                <td style={tdStyle}>{entry.score}</td>
                <td style={tdStyle}>{entry.diceCount}d</td>
                <td style={tdStyle}>{entry.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 10px",
  borderBottom: "2px solid #333",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid #ddd",
};
