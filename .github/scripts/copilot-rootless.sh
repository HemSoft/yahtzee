#!/usr/bin/env bash
set -euo pipefail

readonly COPILOT_VERSION="1.0.79"
readonly COPILOT_INSTALLER="${RUNNER_TEMP}/gh-aw/actions/install_copilot_cli.sh"
readonly COPILOT_BIN="${HOME}/.local/bin/copilot"

export GH_HOST="github.com"

if [[ ! -f "${COPILOT_INSTALLER}" ]]; then
  echo "Copilot installer not found: ${COPILOT_INSTALLER}" >&2
  exit 1
fi

bash "${COPILOT_INSTALLER}" "${COPILOT_VERSION}" --rootless
exec "${COPILOT_BIN}" "$@"
