# Unsigned iOS simulator qualification

The native job in [Application quality](../.github/workflows/quality.yml) uses a standard public GitHub-hosted macOS runner. It does not use Apple credentials, a paid device cloud, signing, upload, TestFlight or App Store submission. Its result is a simulator app, not an installable iPhone archive.

## Inputs

- macOS 26 runner, with the actual runner image version recorded in the receipt.
- Xcode 26.6, build 17F113, selected explicitly at `/Applications/Xcode_26.6.app`.
- iOS Simulator SDK/runtime 26.5; iPhone 17 and iPad Pro 13-inch M5.
- Node 24.12.0, Bun 1.4.2, CocoaPods 1.17.0 and Java 17.
- Maestro CLI 2.10.0, downloaded from its [versioned release](https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.10.0) and checked against SHA-256 `29b675e10cc12080e445e9bfb2e2b4e4dfb9c0f2e30d5884120d258b5e1cd991`.
- The committed Bun lock, Expo app configuration and reviewed CocoaPods lock.

The workflow checks actual tool versions rather than relying on the runner's default Xcode. Hosted images still change. A changed toolchain requires a reviewed pin update; these commands do not promise bit-identical Xcode output across hosts.

## Generated native project

Expo prebuild generates `apps/mobile/ios` from source configuration. This directory is ignored. The runner refuses an existing native directory rather than deleting local work. Run it in a fresh macOS checkout with the listed tools after `bun install --frozen-lockfile --ignore-scripts`:

```sh
bun scripts/ios-native/run.mjs
```

The initial bootstrap retains its generated Podfile.lock as an artifact and remains non-passing until that lock is reviewed and committed at `apps/mobile/native/Podfile.lock`. Subsequent builds copy it into the generated project and use `pod install --deployment`; dependency drift fails the job. For an intentional update, `--refresh-pods` generates a replacement in a fresh checkout. A changed lock remains non-passing until source matches. Do not bypass that check or call a bootstrap a qualified release.

Build configuration is Release, `CODE_SIGNING_ALLOWED=NO`, with an embedded Hermes/JavaScript bundle. The simulator app targets the current host architecture, recorded in the manifest, rather than compiling an unused second simulator slice. It is not a universal Mac distribution. No Metro server is started. The compiled bundle identifier, version, build and minimum iOS 17.0 must match source. The proposed 1.0.0/build 1 and existing development identifiers are not approved public identity or an App Store reservation.

## Native interaction matrix

The job creates and later deletes only its own simulators. First boot has a bounded ten-minute allowance, and captured command output is retained even after timeout. It runs all four modes with solo and three AI opponents, plus a largest-Dynamic-Type start/resume case on both device families. Normal cases cover light/dark and portrait/landscape, complete scoring, native History/Help navigation, cold relaunch and Play Again.

Each start holds a die and rerolls. The runner reads the real app's SQLite document, terminates the process, resumes through the UI and compares the entire document byte-for-byte. Completion must produce one history record. Further cases deliberately damage the saved JSON and then the database file, verify preservation after failed loading, cancel reset, and complete an explicit reset through the native alert.

Maestro uses accessibility text and test IDs, not screenshot-coordinate guesses. Screenshots cover setup, held/rerolled play, resume, results, history, help, diagnostic preview, Play Again and recovery. A simulator recording covers the first start/resume sequence. The status bar is standardized to 9:41 for captures. Test names are synthetic.

This is not airplane-mode, hardware durability, VoiceOver, Switch Control, iPad Stage Manager window-resize or signed-distribution acceptance. Browser-adapter results do not substitute for the native run. Review actual screenshots in one batch, apply one layout correction batch, then confirm. Functional failures still require diagnosis.

## Receipts and retention

`reports/native/manifest.json` records the exact checked-out source commit, toolchain, runner, device/runtime, scenarios, timestamps and SHA-256 hashes of retained artifacts. Pull requests check out their exact head for native captures. Logs and partial receipts survive failures; the required quality gate includes the native job. A screenshot file's existence alone is not visual review or release approval.

The artifact includes the unsigned simulator app, native dependency lock, compiled Info.plist, screenshots, recording, test reports and synthetic database snapshots. DerivedData and installed Pods are not uploaded. Retention is one day to keep storage bounded. Download current-head evidence before it expires, inspect it, and attach the selected images and recording to the PR's Validation section.

References: [GitHub macOS 26 runner inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md), [Maestro local CLI](https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options.md), [Expo SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).
