import { calculateTotal, calculateMaxPossibleScore, getCategories, getMaxCategoryScore, type CategoryId, type GameLog, type HighScores, type WireGame } from "@yahtzee/game-engine";

export { SAVE_KEY } from "./keys";
export const MODES = [5, 6, 8, 10] as const;
export interface Preferences {
  name: string;
  recentNames: string[];
  appearance: "system" | "light" | "dark";
  diceCount: number;
  aiOpponents: number;
}
export interface ActiveGame { game: WireGame; revision: number; startedAt: string }
export interface LocalSave {
  schemaVersion: 1;
  rulesVersion: 2;
  preferences: Preferences;
  active: ActiveGame | null;
  history: GameLog;
  highScores: HighScores;
}

export function emptySave(): LocalSave {
  return { schemaVersion: 1, rulesVersion: 2,
    preferences: { name: "", recentNames: [], appearance: "system", diceCount: 5, aiOpponents: 0 },
    active: null, history: { entries: [] }, highScores: { entries: [] } };
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function integer(value: unknown, low: number, high: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= low && value <= high;
}
function text(value: unknown, max = 100): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max && Array.from(value).every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);
}
function mode(value: unknown): value is number { return typeof value === "number" && MODES.some((n) => n === value); }
function date(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function unique(values: unknown[]): boolean { return new Set(values).size === values.length; }

export function validPreferences(value: unknown): value is Preferences {
  if (!object(value)) return false;
  const names = value.recentNames;
  return (value.name === "" || text(value.name, 32)) && Array.isArray(names) && names.length <= 5
    && names.every((name) => text(name, 32)) && unique(names)
    && typeof value.appearance === "string" && ["system", "light", "dark"].includes(value.appearance)
    && mode(value.diceCount) && integer(value.aiOpponents, 0, 3);
}
function scorecard(value: unknown, diceCount: number, complete: boolean): boolean {
  if (!object(value)) return false;
  const allowed = getCategories(diceCount).map((category) => category.id as string);
  const entries = Object.entries(value);
  return (!complete || entries.length === allowed.length) && entries.every(([key, score]) =>
    allowed.includes(key) && integer(score, 0, getMaxCategoryScore(key as CategoryId, diceCount)));
}
function gamePlayers(value: unknown, diceCount: number, round: number, finished: boolean): boolean {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) return false;
  return value.every((player, index) => object(player) && text(player.id) && text(player.name, 32)
    && player.isAi === (index !== 0) && scorecard(player.scores, diceCount, finished)
    && (finished || Object.keys(player.scores as object).length === round - 1))
    && unique(value.map((player: Record<string, unknown>) => player.id));
}
function gameDice(value: Record<string, unknown>, diceCount: number): boolean {
  return Array.isArray(value.dice) && value.dice.length === diceCount && value.dice.every((die) => integer(die, 1, 6))
    && Array.isArray(value.held) && value.held.length <= diceCount && unique(value.held)
    && value.held.every((index) => integer(index, 0, diceCount - 1));
}
function wireGame(value: unknown): boolean {
  if (!object(value) || !mode(value.diceCount)) return false;
  const rounds = getCategories(value.diceCount).length;
  if (!integer(value.currentRound, 1, rounds) || typeof value.status !== "string" || !["playing", "finished"].includes(value.status)) return false;
  if (!gamePlayers(value.players, value.diceCount, value.currentRound, value.status === "finished")) return false;
  const players = value.players as unknown[];
  return text(value.id) && value.maxRolls === 3 && value.totalRounds === rounds && integer(value.rollsLeft, 0, value.status === "finished" ? 3 : 2)
    && integer(value.currentPlayerIndex, 0, players.length - 1)
    && (value.status === "finished" ? value.currentRound === rounds : value.currentPlayerIndex === 0)
    && gameDice(value, value.diceCount);
}
function activeGame(value: unknown): boolean {
  return value === null || (object(value) && wireGame(value.game)
    && integer(value.revision, 0, Number.MAX_SAFE_INTEGER) && date(value.startedAt));
}
function resultPlayer(value: unknown, diceCount: number): boolean {
  if (!object(value) || !text(value.name, 32) || typeof value.isAi !== "boolean" || !scorecard(value.scores, diceCount, true)) return false;
  return value.score === calculateTotal({ id: "saved", name: value.name, scores: value.scores as Partial<Record<CategoryId, number>> }, diceCount).grandTotal;
}
function result(value: unknown): boolean {
  if (!object(value) || !mode(value.diceCount) || !Array.isArray(value.players)) return false;
  const diceCount = value.diceCount;
  return text(value.id) && date(value.startedAt) && date(value.completedAt) && integer(value.durationSeconds, 0, Number.MAX_SAFE_INTEGER)
    && value.players.length >= 1 && value.players.length <= 4 && value.players.every((player) => resultPlayer(player, diceCount))
    && value.players.some((player: Record<string, unknown>) => player.name === value.winnerName);
}
function highScore(value: unknown): boolean {
  if (!object(value) || !mode(value.diceCount)) return false;
  return text(value.gameId) && text(value.playerName, 32) && typeof value.isAi === "boolean" && date(value.dateRecorded)
    && integer(value.score, 0, calculateMaxPossibleScore({ id: "saved", name: "saved", scores: {} }, value.diceCount)) && integer(value.rankOriginal, 1, 10) && integer(value.rankCurrent, 1, 10);
}
function results(value: Record<string, unknown>): boolean {
  if (!object(value.history) || !object(value.highScores)) return false;
  const history = value.history.entries, scores = value.highScores.entries;
  if (!Array.isArray(history) || history.length > 500 || !history.every(result)) return false;
  if (!Array.isArray(scores) || scores.length > 40 || !scores.every(highScore)) return false;
  if (!unique(history.map((entry: Record<string, unknown>) => entry.id))) return false;
  if (!unique(scores.map((entry: Record<string, unknown>) => JSON.stringify([entry.gameId, entry.playerName, entry.isAi])))) return false;
  return MODES.every((diceCount) => {
    const rows = scores.filter((entry: Record<string, unknown>) => entry.diceCount === diceCount);
    return rows.length <= 10 && rows.every((entry: Record<string, number>, i) => entry.rankCurrent === i + 1 && (i === 0 || rows[i - 1].score >= entry.score));
  });
}

/** Never repair an unknown or damaged document by overwriting it with defaults. */
export function decodeSave(raw: string): LocalSave {
  if (raw.length > 4_000_000) throw new Error("Local save is too large. Your data has not been changed.");
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.schemaVersion !== 1 || value.rulesVersion !== 2 || !validPreferences(value.preferences)
    || !activeGame(value.active) || !results(value)) throw new Error("Local save is damaged or uses unsupported rules. Your data has not been changed.");
  const save = value as unknown as LocalSave;
  if (save.active) {
    const recorded = save.history.entries.some((entry) => entry.id === save.active!.game.id);
    if ((save.active.game.status === "finished") !== recorded) throw new Error("Active game and completion record disagree. Your data has not been changed.");
  }
  return save;
}

/** One-time migration of the old native client's local preferences, not server results. */
export function migratePreferences(namesRaw: string | null, appearanceRaw: string | null): LocalSave {
  const save = emptySave();
  const names: unknown = namesRaw === null ? [] : JSON.parse(namesRaw);
  const preferences = { ...save.preferences, recentNames: names, appearance: appearanceRaw ?? "system" };
  if (!validPreferences(preferences)) throw new Error("Saved preferences could not be read. Your data has not been changed.");
  return { ...save, preferences: { ...preferences, name: preferences.recentNames[0] ?? "" } };
}
