#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  exit 0
fi

staged_files="$(git diff --cached --name-only --diff-filter=ACM || true)"
if [[ -z "$staged_files" ]]; then
  exit 0
fi

if git diff --cached -- . | grep -E -i '(api[_-]?key|secret|password|token)[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']+["'"'"']' >/dev/null 2>&1; then
  echo "[secret-scan] Potential secret detected in staged changes"
  exit 1
fi

echo "[secret-scan] OK"