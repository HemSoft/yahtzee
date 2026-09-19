# Client and backend qualification

## Reproduce

```sh
bun install --frozen-lockfile --ignore-scripts
bun run test:clients:install
bun run test:clients
bun run build:mobile
```

On Linux, install the browser's host libraries with `node node_modules/playwright/cli.js install --with-deps chromium`, then run `xvfb-run --auto-servernum bun run test:clients`. Electron needs a display; Chromium runs headless. The setup command explicitly installs the pinned Electron binary outside the test timeout. Electron 44 can also download on first use, but CI does not rely on that fallback. Native exports need no signing identity or running backend. CI uses `EXPO_OFFLINE=1`, `EXPO_NO_TELEMETRY=1` and the placeholder `EXPO_PUBLIC_CONVEX_URL=https://fixture.invalid`.

The [Playwright configuration](../playwright.config.ts) owns a loopback-only fixture process and refuses to reuse an existing server. Port 5187 must be available. Each Electron test verifies that it uses its own temporary user-data directory and removes that directory on exit. Tests run serially and reset the in-memory database between scenarios. The [fixture server](../tests/clients/server.ts) bundles the actual application components, replaces only their Convex transport and native storage adapter, and invokes the real Convex handlers through Convex-test. It fixes the dice random seed for repeatable journeys. Capabilities still come from the real cryptographic guest-session action.

No production credentials, account session or deployment is used. Application environment URLs are irrelevant to the loopback suite. This checks client/backend behavior, not the real Convex network protocol.

## Platform matrix

| Target | Executed checks | Not claimed |
|---|---|---|
| Web | Real App, shared controls and session hook in Chromium at 1280 by 900 | Other browsers, production Convex transport |
| Desktop | Real Electron main process and isolated preload, real renderer App at the application's window size | Signed installer, packaging or auto-update |
| Mobile source | Actual mobile App and shared hook through react-native-web at 390 by 844, storage through an explicit browser adapter | Native gestures, accessibility services, native AsyncStorage or device execution |
| Android and iOS | Expo production JavaScript and Hermes exports using the real router/layout | APK/IPA creation, signing, installation or simulator/device behavior |

CI runs the client journeys and exports on both Linux and Windows. macOS and native-device execution are not part of this matrix. The Electron test explicitly checks the exposed preload API. This caught a real `.js` versus `.mjs` output mismatch; the build now emits and loads an explicit CommonJS `.cjs` preload without relaxing isolation.

## Scenarios and failure proof

Each interactive target runs complete five- and six-dice games with one AI. The journeys exercise setup, holding, rerolls, keyboard scoring, every category, AI progression, completion, history-backed rankings, play-again and cancellation. Five-dice screenshots use light mode and six-dice screenshots use dark mode.

An offline move must show a pending retry. Reconnection and retry must resume the same game. The fixture also drops the final move's response *after* the real completion transaction commits. Retrying must reveal the finished game while leaving exactly one log and two player receipts/rankings. A delayed move from a cancelled game must not replace a new game's state.

To prove the suite cannot pass a permanently rejected completion, run this negative control from Bash:

```sh
TEST_REJECT_COMPLETION=1 bun run test:clients --project=web --grep '5 dice'
```

PowerShell uses `$env:TEST_REJECT_COMPLETION='1'` before the command and `Remove-Item Env:TEST_REJECT_COMPLETION` afterward. The fixture rejects the final scoring request before persistence. The expected result is a failed test reporting zero logs where one is required. Restore the environment and rerun the ordinary suite. This switch exists only in the test server.

## Evidence and gate

The suite writes setup, active-game, retry and completed-game screenshots, videos, traces and a JSON result under `reports/clients/`. Every test records the Git commit and whether the worktree was dirty. Dirty development captures are not current-head PR evidence. Commit first, rerun, and attach the clean-head captures to the PR.

The [application workflow](../.github/workflows/quality.yml) uploads these artifacts with the tested revision in their name and retains them for three days. The existing fail-closed `quality-gate` includes the client and mobile-export steps. A failed, skipped or cancelled validation job cannot satisfy that gate. Native limitations remain limitations even when all declared checks pass.
