# Production function risk

## Run it

```sh
bun install --frozen-lockfile --ignore-scripts
bun run test:clients:install
bun run quality:measure
```

On Linux, install Playwright host dependencies and use `xvfb-run --auto-servernum bun run quality:measure`, as described in [client qualification](client-qualification.md). No deployment or credentials are needed.

The command clears only its generated raw-counter directory, runs instrumented engine/backend tests, runs all six real-client journeys, and writes `reports/quality/report.md`, `report.json` and `functions.json`. The JSON report records the Git revision and dirty state. The function-only file omits volatile metadata so two runs at one revision can be compared directly. Missing unit/backend/client collections, empty collections and mismatched source locations fail the command.

The pinned tools are TypeScript 6.0.3, istanbul-lib-instrument 6.0.3 and istanbul-lib-coverage 3.2.2. Bun 1.4.2 runs the tests. Runtime plugins add counters only during qualification; application source and shipped bundles are unchanged. Bun test completion hooks persist unit counters because its runner does not invoke process-exit handlers. Client counters and backend counters are captured before fixture shutdown.

## Inventory and metric

The [source inventory](../scripts/quality/sources.ts) scans JavaScript and TypeScript under application directories, package `src` directories and `convex`. It enumerates files before merging execution counters. Unimported functions receive zero observed coverage, rather than disappearing. Undeclared source links fail inventory instead of silently following another directory.

Excluded paths are dependency directories, Convex `_generated`, Expo `.expo`, `.next`, `dist`, `out`, `coverage`, `reports`, `release`, `web-build`, test directories, test/fixture filenames and type declarations. Root maintenance scripts and the test runner are not application production code; their calculation and inventory regressions run in the ordinary test gate. The report includes application build configuration and entry modules even when they contain no functions.

Each concrete function gets its own McCabe-style complexity, starting at one. Decisions include `if`, conditional expressions, loop statements, non-default switch cases, catches, short-circuit operators and assignments, optional-chain segments and default parameters. Nested function bodies belong to their own row, not the enclosing function. IDs use the file, lexical function ancestry and occurrence number. Anonymous callbacks use their binding or callee name. Renaming or moving a function creates a new ID and must not inherit another function's exception accidentally.

Coverage is the fraction of observed Istanbul branch arms owned by that function. A function with no recorded branch arms uses binary function-entry coverage, stated in every row. Istanbul's branch model is not MC/DC and does not measure every possible exception path. No blanket coverage percentage is required.

`CRAP = complexity^2 * (1 - coverage)^3 + complexity`

Coverage is a fraction from zero to one. Calculations retain full precision; display values use four decimals. The report lists the worst 30 functions, and JSON contains every function.

## Gate and initial review

Scores from 15 through 30 require review. New functions above 30 fail. The three pre-existing exceptions in [the baseline](../quality-baseline.json) have exact measured limits and reasons. An exception cannot worsen, and an improved or removed exception must be lowered or removed. Routine measurement never rewrites the baseline. Do not add exceptions for new code or raise a budget to make a failure disappear; policy changes need explicit review with their measured effect.

Initial source baseline is commit `dc1978768479bd3c37555619d681d40f82fd479f`. None of these production functions changed in the measurement PR.

| Existing function | Complexity | Observed branch arms | CRAP limit | Decision |
|---|---:|---:|---:|---|
| Desktop App | 34 | 51/54 | 34.19821673525377 | Preserve measured risk until render-state extraction lowers it |
| Web App | 34 | 51/54 | 34.19821673525377 | Same constraint as desktop |
| Mobile Index | 40 | 61/65 | 40.37287209831589 | Preserve measured risk until screen extraction lowers it |

Better coverage alone cannot put complexity 34 or 40 below CRAP 30. These are visible legacy limits, not claims that the components are low-risk.

Two other initial functions fall in the review band. The [upper scorecard row callback](../packages/ui/src/Scorecard.tsx) measures 16.4087 from complexity 14 and 20/26 branch arms. It combines preview, assigned-score and human/AI presentation cases. The [server applyMove function](../convex/lib/sessionGame.ts) measures 15.0144 from complexity 15 and 24/25 arms. Capability and illegal-move regressions plus complete guest games cover that path. Both remain visible in the report; neither receives an exception.

## Limits

The collected contexts are the instrumented Bun unit/backend process, isolated backend fixture and real client components in Chromium/Electron renderers or the declared mobile web adapter. Electron main/preload and the original browser/Expo bootstrap are inventoried but are not instrumented by these collectors. Their unobserved functions conservatively receive zero coverage, even though other qualification executes the Electron runtime. This report does not claim native-device or production-transport coverage. See [the platform matrix](client-qualification.md).

## Regression proofs

[The metric tests](../packages/game-engine/tests/qualityMetrics.test.ts) verify the formula, nested ownership, default parameters, loops and the exact 30 boundary. A nested-branch fixture changes complexity 10 to 11 while only calling its outer false path. Coverage falls from 1/18 to 1/20, CRAP increases, and the previously accepted legacy budget rejects it. Inventory tests include unimported JS/TS and prove that generated files, declarations and tests stay excluded.

To check repeatability, run `bun run quality:measure`, copy its function-only JSON outside the generated report directory, run again without changing the revision, and compare the files byte-for-byte. Capture duration separately; it is not part of the comparison.

Both hosted operating systems execute this command inside the required application qualification. Revision-named artifacts retain the report, counters and client evidence. A metric failure fails the existing `quality-gate`; scheduled results from another commit cannot replace it.
