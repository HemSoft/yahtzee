# Native offline storage

The iOS and Android app uses the shared rules through a small asynchronous storage interface. Web and Electron keep their existing adapters and online authority. Native gameplay does not construct a Convex client or send results to the online leaderboard.

## Document and commit boundary

`apps/mobile/src/local/save.ts` validates a schema-1, rules-2 JSON document under `hemsoft-local-dice-v1`. It contains preferences, one active game with a revision, the last 500 completed games and all-time top tens per mode. Native development currently supports 5, 6, 8 and 10 dice, one human and zero to three AI opponents. These are reversible engineering defaults, not release-scope approval.

The store computes each move once, including AI turns, and stages its exact serialized document. It publishes state only after storage acknowledges the write. A failed acknowledgment blocks further moves. Retry writes the same bytes; it does not roll again or append another result. Explicit reload reads the stored state and abandons only the pending in-memory move. An unacknowledged move may be absent after process termination.

Native builds select `platformStorage.native.ts`. Expo SQLite 57.0.3 stores the document as one parameter-bound SQL value in the dedicated `hemsoft-local-dice.db` database. Writes use SQLite autocommit with WAL and `synchronous=FULL`. Database format version 1 is separate from the document/rules versions. Loading checks integrity and the database version before schema or journal changes. Unsupported databases, unreadable storage, invalid JSON and invalid game state produce a visible recovery error rather than a reset.

The web development adapter uses AsyncStorage's web implementation. Browser journeys are supplementary and do not test native SQLite, UIKit navigation, safe areas or VoiceOver.

## Why game saves do not use native AsyncStorage

Inspection of AsyncStorage 2.2.0's iOS implementation found two unsuitable behaviors for this contract. It recreates its in-memory manifest after manifest JSON damage, and it removes an external value file before committing a replacement inline value. A validator above `getItem` cannot reliably detect the first case. Native AsyncStorage remains only for importing the old names/theme preferences. No online scores are imported. No native game document from this branch had shipped before this backend change.

## Recovery and deletion

Normal load and failed writes never call the database deletion API. The Help reset requires confirmation. Reset closes the connection, removes only the dedicated database and its WAL, shared-memory and rollback-journal files, removes the two owned legacy preference keys, then writes defaults. Missing database files are tolerated; permission and other deletion failures remain visible and retryable. Other keys and apps are untouched. A successful reset/reload also clears unsaved UI name drafts.

SQLite transaction recovery is not a guarantee against device loss, arbitrary filesystem destruction or faulty storage hardware. The app has no remote backup service or recovery account. Keep damaged bytes available for diagnosis until the user chooses reset. Do not add a catch-and-recreate path for database errors.

## Backup and uninstall

The development default uses Expo SQLite's iOS Documents/SQLite directory. It is eligible for standard OS-controlled device backup; the app does not independently sync it. Deleting the app removes its local container. Offloading can retain data, and restoring an older device backup can restore older games and preferences. Reset does not erase existing OS backups. No application-level database encryption is configured.

Physical backup/restore, uninstall and locked-device behavior still need device qualification. The owner must review the final privacy disclosures before release. These source-level defaults are not an attestation that a particular backup has succeeded.

## Evidence boundaries

- `nativePersistence.test.ts` covers validation, staged retries, concurrency, all modes, completion retention and reset at the storage interface.
- `nativeSqlite.test.ts` uses real temporary SQLite files through Bun. It covers corruption preservation, schema rejection, SQL binding, restart, acknowledgment loss and explicit reset. It does not run Expo's native module.
- The [native simulator workflow](native-simulator.md) builds and exercises the actual Expo iOS app, reads its database, compares resume bytes and tests corrupt documents/databases through the native recovery UI.
- Real iPhone/iPad airplane-mode, VoiceOver, interruption, backup and TestFlight acceptance remain separate requirements in [issue 41](https://github.com/HemSoft/yahtzee/issues/41) and [issue 42](https://github.com/HemSoft/yahtzee/issues/42).
