# Dependency security

The September 18, 2026 baseline contained 24 affected package names and 116 distinct advisory URLs. The updated locked graph returns an empty `bun audit --json` report. No exceptions are accepted.

- [Original scanner report](audit-before.json)
- [Updated scanner report](audit-after.json)
- [Per-advisory inventory](advisory-inventory.json), including exact locked versions, representative dependency paths, reachability assessments and dispositions. Multiple affected versions can produce multiple rows for one URL.

Scanner severity is not evidence that an application endpoint is exploitable. Electron advisories differ by API; developer-server and build-tool advisories still matter when their inputs or network peers are untrusted. No production exploit was attempted.

## Updated toolchain

Direct toolchain versions are pinned. Expo 57.0.24 uses its published React 19.2.3, React Native 0.86.3 and native-module compatibility set. `expo install --check` passes. TypeScript 6.0.3 matches that SDK. Explicit repository root directories in the web/desktop typechecks accommodate TypeScript 6's changed root-directory default and Convex's typed API imports.

Electron 44.4.3, electron-vite 5.0.0, Vite 7.3.6 and plugin-react 5.2.0 have compatible peer ranges. Vite 8 is intentionally not selected because electron-vite 5 supports Vite 5 through 7. Convex 1.46.0 and convex-test 0.0.59 are aligned. The lockfile was regenerated from the pinned manifests to refresh stale compatible transitive versions; subsequent frozen installs preserve it.

Node must satisfy the root `engines` field. Qualification uses Node 24 and Bun 1.3.7. Expo Android JavaScript/Hermes export passes; that is not a native device, signing or installation test.

## Compatibility patch

Two transitive overrides remove the final advisories. UUID 11.1.1 retains CommonJS and ESM entry points. The fixed decode-uri-component 0.5.0 is ESM-only, while Expo Router's query-string 7 consumer expects a CommonJS function. [The one-line patch](../../patches/query-string@7.1.3.patch) selects its default export. Bun applies this checked-in patch during frozen installs; editing node_modules by hand is not the delivery mechanism.

The test suite resolves query-string through the actual Expo Router installation and checks parsing, encoding, repeated values, Unicode and malformed input. Remove the override/patch together when the upstream router consumes a compatible fixed query-string release. HemSoft owns this follow-up. Review it by October 18, 2026; it is a compatibility patch, not an advisory suppression.

## Continuous checks

`bun run security` runs the native Bun scanner against the full lockfile and fails on every unaccepted advisory, including low severity. Invalid reports, scanner failures and expired exceptions fail closed. [Dependency security](../../.github/workflows/dependencies.yml) runs for all PRs, main pushes and daily, with isolated hosted runners and no deployment credentials. Require its exact `dependency-audit` status after installation, alongside `quality-gate`.

Dependabot alerts and security updates are enabled. [The updater configuration](../../.github/dependabot.yml) uses the supported **bun** ecosystem at the workspace root, plus GitHub Actions updates. Earlier automatic npm scanning of the nested desktop manifest failed because it lacked a recognized lockfile or exact Electron requirement. The Bun configuration uses the actual text lockfile. See [GitHub's supported ecosystems](https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories).

Future exceptions require an exact package/advisory URL, owner, concrete rationale and expiry in [security-exceptions.json](../../security-exceptions.json), reviewed in a PR. The empty list is intentional. A negative validation temporarily restored vulnerable UUID 8.3.2; the real security command exited 1 on GHSA-w5hq-g745-h8pq. Restoring the reviewed manifest/lockfile returned the check to green.
