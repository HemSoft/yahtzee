# Scoring versions and deployment

The 50-point Full Straight and revised upper-section bonus thresholds are **rules version 2**. Previously stored Convex results have no `rulesVersion` field and belong to historical version 1. They must not compete with version 2 totals or enter its history averages.

## Additive transition

The schema adds optional `rulesVersion` fields to guest sessions, game logs and high scores, plus version-prefixed indexes. Existing rows remain valid. No backfill, deletion or score recalculation is required or performed. Never label historical totals as version 2 without independently reconstructing and verifying their original games.

New sessions and server-computed results carry version 2. Ranking reads and top-ten eviction use its own index partition. History reads use the same partition before their 200-row limit. Existing clients default to version 2, so their averages cannot mix rule sets. Historical verified rows remain available by passing `rulesVersion: 1` to `highScores.top` or `gameLogs.list`. That selector refers to the original unversioned partition, not rows manually tagged `1`.

Unverified client-authored rows remain excluded from both views. Durable completion receipts remain unique across rule versions because a game can finish only once.

## Active-game cutover

A pre-upgrade session cannot continue under changed scoring rules. Read/move requests return `Scoring rules changed. Start a new game.` without changing the saved session, awarding points or writing a result. The player must cancel/start again. Its existing 12-hour expiry still applies. This is deliberate rather than silently mixing old scored categories with new totals.

For a production rollout, communicate that restart requirement and choose a quiet deployment window. Deploy the additive schema and functions together through the normal Convex deployment workflow. Confirm new indexed reads and a new game's version-2 result in the target environment. This repository change does not itself deploy or alter production data.

## Rollback

Do not restore the old unpartitioned ranking/history readers over a database that already contains version-2 rows. Keep this additive schema and partitioned readers. If the gameplay rollout must stop, disable new game starts while investigating; preserve both result partitions. Any return to the old engine needs an explicit version-aware implementation, not a blind source rollback.

## Regression coverage

The backend tests prove that historical verified results remain readable separately, cannot occupy or be evicted from the new top ten, and do not enter new-rule history. They also prove that old active sessions reject without writes, fresh sessions/results are versioned, and existing authorization, completion and replay protection still hold.
