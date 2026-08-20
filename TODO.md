# GH AW on the mini self-hosted runner

Status: Pilot source compiled, dispatch blocked

Last verified: 2026-08-19 from `home`

## Goal

Prove one harmless GitHub Agentic Workflow on the isolated Yahtzee runner,
then use that evidence to design a safe SFL deployment for trusted HemSoft
repositories.

## Verified infrastructure

- [x] Repository runner `mini-github-runner-01` is online with labels
  `self-hosted`, `Linux`, `X64`, `mini`, and `yahtzee`.
- [x] The runner remains inside Ubuntu 24.04 VM `github-runner-01` with 4 vCPUs,
  5 GiB RAM, and a 100 GiB sparse disk.
- [x] Docker Engine 29.7.2 and Docker Compose 5.5.0 run inside the guest.
- [x] The non-sudo `actions` account can use the guest-local Docker socket.
- [x] GitHub CLI 2.45.0 and ripgrep 14.1.0 are installed in the guest.
- [x] GitHub API and GHCR are reachable over public HTTPS.
- [x] LAN, Tailscale, RFC1918, and link-local access remain blocked from the
  guest after Docker installation.
- [x] Existing manual smoke run
  [32323195241](https://github.com/HemSoft/yahtzee/actions/runs/32323195241)
  succeeded after provisioning.

Node.js is intentionally not installed globally. Current GH AW compilation for
a nonstandard runner must emit `actions/setup-node` and install the selected
Node version within the workflow.

## Safety decisions

- [x] Keep Yahtzee's current self-hosted workflows manual-only while the runner
  is persistent and the repository is public.
- [x] Never route `pull_request`, `pull_request_target`, or untrusted fork code
  to this persistent runner.
- [x] Keep tokens read-only unless a reviewed safe-output job needs a specific
  write permission.
- [x] Change GH AW Markdown source and regenerate `.lock.yml`; never hand-edit a
  generated lock workflow.
- [x] Do not grant the `actions` account sudo and do not expose mini's host
  filesystem or Docker socket.

## Milestone 1: Harmless GH AW smoke

- [x] Resolve and pin the exact `gh aw` compiler version used for the pilot.
  The fixed home binary is stable release `v0.86.2`, tag commit
  `48e5fa3ff52294d91d97715017a9f8693a48387f`. Its Windows AMD64 SHA-256 is
  `1ddfeabde198be39f277001ce4f3daea33366cf98aae7e0a9db3d615bc9df174`,
  which matches the published release asset. The generated lock records
  `compiler_version: "v0.86.2"`.
- [ ] Confirm the Copilot authentication and billing path available to the
  personal `HemSoft` account before adding a secret or permission. The local
  Copilot CLI confirms that `HemSoft` has an active individual plan without
  consuming AIC during the check. Because `HemSoft` is a user account rather
  than an organization, this pilot requires a fine-grained personal access
  token with account permission `Copilot Requests: Read`, stored as repository
  secret `COPILOT_GITHUB_TOKEN`. That secret does not exist yet.
- [x] Add a `workflow_dispatch`-only GH AW Markdown source with zero safe
  outputs and minimum token permissions.
- [x] Target the main agent job with
  `runs-on: [self-hosted, Linux, X64, mini, yahtzee]`.
- [ ] Configure Copilot CLI installation in rootless mode so the workflow does
  not depend on runner sudo. Compiler `v0.86.2` emits
  `install_copilot_cli.sh` without `--rootless` for a conventional self-hosted
  runner. It emits `--rootless` only for `runner.topology: arc-dind`, which is
  not this VM and must not be declared as a workaround.
- [x] Compile and validate the generated lock workflow with the pinned compiler.
  `gh aw validate self-hosted-agentic-smoke --strict --json` passes with no
  errors or warnings. An independent actionlint 1.7.12 container run inside the
  guest passed with exit code 0 after ignoring only the configured custom
  runner labels and `gh-aw`'s `concurrency.queue` extension. `gh aw lint`
  separately has a wrapper defect: it reports zero issues and then returns exit
  code 1 with `strict mode: actionlint found 0 errors`.
- [x] Confirm the lock file includes Node setup for the self-hosted runner.
  The main agent job uses SHA-pinned `actions/setup-node` v7 with Node 24.
- [ ] Run the workflow and prove the main agent job used
  `mini-github-runner-01`.
- [ ] Record the run URL, job ID, commit SHA, duration, conclusion, and engine.
- [ ] Confirm post-job workspace and GH AW Docker container cleanup.
- [ ] Record peak guest memory, disk use, and Docker disk use.
- [ ] Re-run guest network-isolation checks after the first GH AW job.

## Milestone 2: Move generated jobs deliberately

- [ ] Decide whether activation, safe-output, maintenance, and other framework
  jobs should remain on `ubuntu-slim` during the pilot.
- [ ] If they move to mini, add matching `runs-on-slim` and safe-output runner
  settings in the Markdown source, then recompile.
- [ ] Prove the single runner's serialized execution does not cause workflow
  timeouts or unacceptable queueing.

## Milestone 3: SFL feasibility pilot

- [ ] Make SFL runner changes in the upstream workflow source before deploying
  consumer copies.
- [ ] Register a distinct repository runner service wherever the deployed SFL
  workflow executes. The current registration belongs only to Yahtzee.
- [ ] Confirm SFL's GitHub App, safe-output permissions, and Copilot billing are
  scoped to the selected HemSoft test repository.
- [ ] Start with one trusted private PR and low review effort.
- [ ] Verify SFL's ripgrep setup takes the preinstalled path without sudo.
- [ ] Measure total duration, AIC, memory, disk, Docker cleanup, and review
  correctness before widening use.
- [ ] Keep public or otherwise untrusted PR review on GitHub-hosted runners until
  mini has a one-job ephemeral runner with a clean VM restore or rebuild.

## Monitoring

- Runner status: <https://github.com/HemSoft/yahtzee/settings/actions/runners>
- Workflow runs: <https://github.com/HemSoft/yahtzee/actions>
- Existing smoke workflow:
  <https://github.com/HemSoft/yahtzee/actions/workflows/self-hosted-smoke.yml>

## Current blockers

- Repository secret `COPILOT_GITHUB_TOKEN` has not been created. The existing
  GitHub CLI OAuth token is not a supported substitute for this Actions job.
- Stable compiler `v0.86.2` cannot emit rootless Copilot CLI installation for
  this conventional self-hosted VM. The generated step would call `sudo`, and
  the `actions` account intentionally has no sudo access.
- Persistent mini runners remain out of scope for untrusted PR code.

## Pilot compile evidence

- Source: `.github/workflows/self-hosted-agentic-smoke.md`
- Generated lock: `.github/workflows/self-hosted-agentic-smoke.lock.yml`
- Compiler-owned reproducibility files: `.github/aw/actions-lock.json` and
  `.gitattributes`; the action lock pins `github/gh-aw-actions/setup@v0.86.2`
  to commit `6aab9e5b5c91c615506061f09bedd81a23babe3c`.
- Compiler validation:
  `gh aw validate self-hosted-agentic-smoke --strict --json`
- Lock inspection confirms compiler `v0.86.2`, Copilot CLI `1.0.79`, the exact
  self-hosted label set, Node 24 setup, a rootless AWF install, and a non-rootless
  Copilot CLI install.
- Independent actionlint used pinned image
  `rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667`
  inside the guest, passed with exit code 0, and the temporary image was removed.
- Guest isolation was rechecked afterward and returned `ISOLATION_OK` with
  Tailscale absent and all tested tailnet, LAN, RFC1918 destinations blocked.
- No agentic workflow was dispatched because the missing secret and runtime
  sudo dependency are known preflight failures.
