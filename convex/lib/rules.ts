import { v } from "convex/values";

/** Missing stored versions are the historical, pre-50-point-straight rules. */
export const CURRENT_RULES_VERSION = 2;
export const rulesVersion = v.optional(v.union(v.literal(1), v.literal(2)));

export function rulesPartition(version?: 1 | 2) {
  return version === 1 ? undefined : CURRENT_RULES_VERSION;
}

export function requireCurrentRules(session: { rulesVersion?: number }) {
  if (session.rulesVersion !== CURRENT_RULES_VERSION) throw new Error("Scoring rules changed. Start a new game.");
}
