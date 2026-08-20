---
name: Self-hosted agentic smoke
on:
  workflow_dispatch:

permissions:
  contents: read

engine: codex
max-ai-credits: 30
runs-on: [self-hosted, Linux, X64, mini, yahtzee]
timeout-minutes: 10
tools: {}
---

# Self-hosted agentic smoke

Reply with exactly `SELF_HOSTED_AGENTIC_SMOKE_OK`. Do not use tools or modify
files.
