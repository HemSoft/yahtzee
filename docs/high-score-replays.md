# High-score replay contract

A result is identified by game ID, player name, AI flag and dice count. Player names are fixed during a game; a human and AI with the same name remain distinct. A changed score under the same identity is a replay, not an update.

Server-authorized completion reads and inserts an indexed durable receipt in the same Convex transaction as the leaderboard update. Concurrent mutation transactions conflict on that read and retry against the committed receipt. A replay does not change the leaderboard, even if the original entry has been evicted or never qualified. Keep receipts for as long as the game ID can be replayed; do not independently expire them.

The schema addition needs no existing-data rewrite. The legacy public submission endpoint now rejects requests; clients send authorized game moves, never totals. An existing leaderboard entry is recognized and receives a receipt on its first replay. Already-evicted legacy entries cannot be reconstructed by this change. Existing duplicate rows are not deleted by a migration. No production data migration is included.

Run `bun run test` for sequential, cutoff, legacy, identity and concurrent Convex-test regressions. Capability authorization and server-computed results are covered by [the guest-game contract](guest-games.md). Legacy unverified results remain stored but are excluded from trusted views.
