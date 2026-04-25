import type { PlayerState } from "./game";
import { calculateTotal } from "./game";

// ─── Game Log Types ───────────────────────────────────────

export interface GameLogPlayer {
  name: string;
  isAi: boolean;
  score: number;
  scores: Partial<Record<string, number>>;
}

export interface GameLogEntry {
  id: string;
  diceCount: number;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  players: GameLogPlayer[];
  winnerName: string;
}

export interface GameLog {
  entries: GameLogEntry[];
}

// ─── High Score Types ─────────────────────────────────────

export interface HighScoreEntry {
  diceCount: number;
  dateRecorded: string;
  score: number;
  playerName: string;
  isAi: boolean;
  gameId: string;
  rankOriginal: number;
  rankCurrent: number;
}

export interface HighScores {
  entries: HighScoreEntry[];
}

// ─── Constants ────────────────────────────────────────────

const MAX_HIGH_SCORES_PER_DICE_COUNT = 10;

// ─── Game Log Functions ───────────────────────────────────

export function createEmptyGameLog(): GameLog {
  return { entries: [] };
}

export function addGameLogEntry(
  log: GameLog,
  game: { id: string; diceCount: number; players: PlayerState[] },
  startedAt: string,
): GameLog {
  const completedAt = new Date().toISOString();
  const startDate = new Date(startedAt);
  const endDate = new Date(completedAt);
  const durationSeconds = Math.round((endDate.getTime() - startDate.getTime()) / 1000);

  const players: GameLogPlayer[] = game.players.map((p) => ({
    name: p.name,
    isAi: !!p.isAi,
    score: calculateTotal(p, game.diceCount).grandTotal,
    scores: { ...p.scores },
  }));

  const winner = players.reduce((best, p) => (p.score > best.score ? p : best), players[0]);

  const entry: GameLogEntry = {
    id: game.id,
    diceCount: game.diceCount,
    startedAt,
    completedAt,
    durationSeconds,
    players,
    winnerName: winner.name,
  };

  return { entries: [...log.entries, entry] };
}

export function getPlayerAverageScore(log: GameLog, playerName: string, diceCount: number): number {
  const matching = log.entries
    .filter((e) => e.diceCount === diceCount)
    .flatMap((e) => e.players)
    .filter((p) => p.name === playerName);

  if (matching.length === 0) return 0;
  return Math.round(matching.reduce((sum, p) => sum + p.score, 0) / matching.length);
}

export function getPlayerGameCount(log: GameLog, playerName: string, diceCount: number): number {
  return log.entries
    .filter((e) => e.diceCount === diceCount)
    .filter((e) => e.players.some((p) => p.name === playerName))
    .length;
}

// ─── High Score Functions ─────────────────────────────────

export function createEmptyHighScores(): HighScores {
  return { entries: [] };
}

function scoreQualifies(score: number, forDiceCount: HighScoreEntry[]): boolean {
  return (
    forDiceCount.length < MAX_HIGH_SCORES_PER_DICE_COUNT ||
    score > forDiceCount[forDiceCount.length - 1].score
  );
}

function recalculateRanks(entries: HighScoreEntry[]): HighScoreEntry[] {
  const diceCountsPresent = [...new Set(entries.map((e) => e.diceCount))];
  const result: HighScoreEntry[] = [];
  for (const dc of diceCountsPresent) {
    const forDc = entries
      .filter((e) => e.diceCount === dc)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_HIGH_SCORES_PER_DICE_COUNT);
    result.push(...forDc.map((entry, i) => ({ ...entry, rankCurrent: i + 1 })));
  }
  return result;
}

export function updateHighScores(
  highScores: HighScores,
  game: { id: string; diceCount: number; players: PlayerState[] },
): HighScores {
  const now = new Date().toISOString();
  const newEntries = [...highScores.entries];

  for (const player of game.players) {
    const score = calculateTotal(player, game.diceCount).grandTotal;
    const forDiceCount = newEntries
      .filter((e) => e.diceCount === game.diceCount)
      .sort((a, b) => b.score - a.score);

    if (scoreQualifies(score, forDiceCount)) {
      const rank = forDiceCount.filter((e) => e.score > score).length + 1;
      newEntries.push({
        diceCount: game.diceCount,
        dateRecorded: now,
        score,
        playerName: player.name,
        isAi: !!player.isAi,
        gameId: game.id,
        rankOriginal: rank,
        rankCurrent: rank,
      });
    }
  }

  return { entries: recalculateRanks(newEntries) };
}

export function getHighScoresForDiceCount(highScores: HighScores, diceCount: number): HighScoreEntry[] {
  return highScores.entries
    .filter((e) => e.diceCount === diceCount)
    .sort((a, b) => a.rankCurrent - b.rankCurrent);
}
