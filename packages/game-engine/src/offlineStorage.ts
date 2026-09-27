import type { GameLog, HighScores } from "./storage";

export const OFFLINE_RESULTS_KEY = "yahtzee-offline-results-v1";
export interface OfflineResults { version: 1; history: GameLog; highScores: HighScores }
export interface OfflineStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function score(value: unknown): boolean { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function player(value: unknown): boolean {
  return object(value) && typeof value.name === "string" && score(value.score);
}
function historyEntry(value: unknown): boolean {
  return object(value) && typeof value.id === "string" && score(value.diceCount)
    && Array.isArray(value.players) && value.players.length > 0 && value.players.every(player);
}
function highScore(value: unknown): boolean {
  if (!object(value)) return false;
  return ["gameId", "playerName", "dateRecorded"].every((key) => typeof value[key] === "string")
    && ["score", "diceCount", "rankCurrent", "rankOriginal"].every((key) => score(value[key]))
    && typeof value.isAi === "boolean";
}
function entries(value: unknown, valid: (entry: unknown) => boolean): boolean {
  return object(value) && Array.isArray(value.entries) && value.entries.every(valid);
}

/** Reject damaged saves rather than silently overwriting a player's scores. */
export function readOfflineResults(storage: OfflineStorage): OfflineResults {
  const raw = storage.getItem(OFFLINE_RESULTS_KEY);
  if (raw === null) return { version: 1, history: { entries: [] }, highScores: { entries: [] } };
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || !entries(value.history, historyEntry) || !entries(value.highScores, highScore)) {
    throw new Error("Saved offline scores could not be read");
  }
  return value as unknown as OfflineResults;
}
