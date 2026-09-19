import { useCallback, useEffect, useState } from "react";
import { getFunctionName, type FunctionArgs, type FunctionReference, type FunctionReturnType } from "convex/server";

async function call(kind: string, name: string, args: unknown): Promise<unknown> {
  try {
    const response = await fetch("/rpc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, name, args }) });
    if (!response.ok) throw new Error("Fixture request failed");
    return await response.json();
  } finally {
    if (kind !== "query") window.dispatchEvent(new Event("fixture-data-changed"));
  }
}

export function useQuery<Q extends FunctionReference<"query">>(reference: Q, args: FunctionArgs<Q>): FunctionReturnType<Q> | undefined {
  const name = getFunctionName(reference); const key = JSON.stringify(args);
  const [value, setValue] = useState<FunctionReturnType<Q>>();
  useEffect(() => {
    let active = true; let generation = 0;
    const refresh = () => {
      const attempt = ++generation;
      void call("query", name, JSON.parse(key)).then((result) => {
        if (active && attempt === generation) setValue(result as FunctionReturnType<Q>);
      }).catch(() => { /* Offline reads retain their last confirmed value. */ });
    };
    refresh(); window.addEventListener("fixture-data-changed", refresh); window.addEventListener("online", refresh);
    return () => { active = false; window.removeEventListener("fixture-data-changed", refresh); window.removeEventListener("online", refresh); };
  }, [name, key]);
  return value;
}

function useCall<F extends FunctionReference<"action" | "mutation">>(kind: string, reference: F) {
  const name = getFunctionName(reference);
  return useCallback((args: FunctionArgs<F>) => call(kind, name, args) as Promise<FunctionReturnType<F>>, [kind, name]);
}
export function useMutation<F extends FunctionReference<"mutation">>(reference: F) { return useCall("mutation", reference); }
export function useAction<F extends FunctionReference<"action">>(reference: F) { return useCall("action", reference); }
