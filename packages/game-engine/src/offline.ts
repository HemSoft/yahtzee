import { applySessionMove, fromWire, newSessionGame, type Move, type WireGame } from "./session";
import { addGameLogEntry, updateHighScores } from "./storage";
import { OFFLINE_RESULTS_KEY, readOfflineResults, type OfflineResults, type OfflineStorage } from "./offlineStorage";

type Snapshot = { gameId: string; revision: number; game: WireGame };
type Request = { gameId: string; secret: string; revision: number; move: Move };
type Pending = { signature: string; snapshot: Snapshot; results: OfflineResults };

function completedResults(results: OfflineResults, game: WireGame, startedAt: string): OfflineResults {
  if (game.status !== "finished") return results;
  const state = fromWire(game);
  const history = addGameLogEntry(results.history, state, startedAt);
  // Keep local storage bounded; all-time top tens are retained separately.
  history.entries = history.entries.slice(-500);
  return { version: 1, history, highScores: updateHighScores(results.highScores, state) };
}

/** Local-only adapter. No network, credentials, server, or Convex runtime. */
export function createOfflineBackend(storage: OfflineStorage) {
  let results: OfflineResults = { version: 1, history: { entries: [] }, highScores: { entries: [] } };
  let loadFailed = false;
  try { results = readOfflineResults(storage); } catch { loadFailed = true; }
  let current: Snapshot | null = null;
  let pending: Pending | null = null;
  let startedAt = "";

  async function start(options: { name: string; diceCount: number; aiOpponents: number }) {
    if (loadFailed) throw new Error("Saved offline scores could not be read");
    const name = options.name.trim();
    if (!name || name.length > 32) throw new Error("Enter a name of 1 to 32 characters");
    const game = newSessionGame(name, options.diceCount, options.aiOpponents);
    // Check persistence before allowing a game whose scores could not be saved.
    storage.setItem(OFFLINE_RESULTS_KEY, JSON.stringify(results));
    game.id = crypto.randomUUID();
    current = { gameId: game.id, revision: 0, game };
    pending = null; startedAt = new Date().toISOString();
    return { ...structuredClone(current), secret: game.id };
  }

  function checkRequest(request: Request): Snapshot {
    if (!current || request.gameId !== current.gameId || request.secret !== current.gameId) throw new Error("Game is no longer active");
    if (!Number.isSafeInteger(request.revision) || request.revision < 0 || request.revision > current.revision) throw new Error("Invalid game revision");
    return current;
  }

  async function move(request: Request): Promise<Snapshot> {
    const state = checkRequest(request);
    if (request.revision < state.revision) return structuredClone(state);
    const signature = JSON.stringify(request);
    if (pending && pending.signature !== signature) throw new Error("Retry the pending move first");
    if (!pending) {
      const game = applySessionMove(state.game, request.move);
      pending = { signature, snapshot: { ...state, revision: state.revision + 1, game },
        results: completedResults(results, game, startedAt) };
    }
    // Keep a failed final move staged so retry cannot reroll AI dice or double-save.
    if (pending.results !== results) storage.setItem(OFFLINE_RESULTS_KEY, JSON.stringify(pending.results));
    results = pending.results; current = pending.snapshot; pending = null;
    return structuredClone(current);
  }

  return { start, move, results: () => results };
}
