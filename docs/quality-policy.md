# Application qualification

Application quality runs for every pull request, main update and merge-group candidate. It has no path filters. Linux and Windows each run the locked install, all-workspace/backend typecheck, lint, tests and both production builds. Each independent check runs after a successful install even if another check failed. A failed, cancelled or skipped validation matrix cannot make `quality-gate` pass.

Use GitHub-hosted runners for untrusted pull-request code. The persistent mini runner remains manual-only. Workflow tokens are read-only, action references are pinned, jobs have timeouts and newer updates cancel stale runs. No deployment credentials are needed.

The main branch must require the exact status `quality-gate`, require it against an up-to-date branch and require resolved conversations. Disable force pushes and deletions and apply the rule to administrators. Do not bypass a failing application check. Verify these live settings after installing the workflow; checked-in YAML alone is not enforcement.

Connected Codex current-head review is the mission's review policy. It may return a clean comment instead of formal approval. No additional human-approval count is introduced by this workflow. If maintainers add one later, it becomes a separate required gate. Administrative bypasses require an explicit incident decision and must not substitute for missing test evidence.

Record run URLs, queue time and final qualification duration when changing CI. No performance target is invented here. Keep expensive future mutation/E2E/soak checks tied to the exact candidate rather than treating scheduled runs of another commit as merge evidence.

Native signed iOS/Android packages are outside this build matrix; mobile TypeScript is checked on both hosts. Desktop bundling is not an installation or code-signing test.
