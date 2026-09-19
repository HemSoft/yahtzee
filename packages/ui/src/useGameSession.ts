import { useCallback, useRef, useState } from "react";
import type { GameState, CategoryId } from "@yahtzee/game-engine";

type RemoteGame = Omit<GameState, "held"> & { held: number[] };
type Snapshot<I extends string> = { gameId: I; revision: number; game: RemoteGame };
type Move = { kind: "roll" } | { kind: "hold"; index: number } | { kind: "score"; category: string };
type Request<I extends string> = { gameId: I; secret: string; revision: number; move: Move };
type StartOptions = { name: string; diceCount: number; aiOpponents: number };
interface Backend<I extends string> {
  start: (args: StartOptions) => Promise<Snapshot<I> & { secret: string }>;
  move: (args: Request<I>) => Promise<Snapshot<I>>;
}

function localGame(game: RemoteGame): GameState { return { ...game, held: new Set(game.held) }; }

/** Shared web/desktop/native request lifecycle. Capabilities stay in memory. */
export function useGameSession<I extends string>(backend: Backend<I>) {
  const { start: startRequest, move: moveRequest } = backend;
  const [game, setGame] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const credentials = useRef<Omit<Request<I>, "move"> | null>(null);
  const pending = useRef<Request<I> | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);

  const reset = useCallback(() => {
    generation.current++; credentials.current = null; pending.current = null; locked.current = false;
    setGame(null); setBusy(false); setError(null); setCanRetry(false);
  }, []);

  const start = useCallback(async (options: StartOptions) => {
    if (locked.current) return null;
    const attempt = ++generation.current;
    locked.current = true; pending.current = null; credentials.current = null;
    setBusy(true); setError(null); setCanRetry(false);
    try {
      const result = await startRequest(options);
      if (attempt !== generation.current) return null;
      credentials.current = { gameId: result.gameId, secret: result.secret, revision: result.revision };
      const next = localGame(result.game); setGame(next); return next;
    } catch {
      if (attempt === generation.current) setError("Could not start the guest game. Check your connection and try again.");
      return null;
    } finally {
      if (attempt === generation.current) { locked.current = false; setBusy(false); }
    }
  }, [startRequest]);

  const perform = useCallback(async (request: Request<I>) => {
    if (locked.current) return;
    const attempt = generation.current;
    locked.current = true; pending.current = request; setBusy(true); setError(null);
    try {
      const result = await moveRequest(request);
      if (attempt !== generation.current) return;
      credentials.current = { gameId: result.gameId, secret: request.secret, revision: result.revision };
      pending.current = null; setCanRetry(false); setGame(localGame(result.game));
    } catch {
      if (attempt === generation.current) {
        setCanRetry(true);
        setError("Could not confirm the move. Retry to check whether it was saved. Quit if the game has expired.");
      }
    } finally {
      if (attempt === generation.current) { locked.current = false; setBusy(false); }
    }
  }, [moveRequest]);

  const send = useCallback((move: Move) => {
    if (credentials.current && !pending.current) void perform({ ...credentials.current, move });
  }, [perform]);
  const retry = useCallback(() => { if (pending.current) void perform(pending.current); }, [perform]);
  const roll = useCallback(() => send({ kind: "roll" }), [send]);
  const toggleHold = useCallback((index: number) => send({ kind: "hold", index }), [send]);
  const selectCategory = useCallback((category: CategoryId) => send({ kind: "score", category }), [send]);
  return { game, busy, error, canRetry, retry, start, reset, roll, toggleHold, selectCategory };
}
