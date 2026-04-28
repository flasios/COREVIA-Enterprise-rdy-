#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

cd "$repo_root"
rm -rf dist coverage playwright-report test-results node_modules/.vite node_modules/.cache
find apps/web domains -type d -name dist -prune -exec rm -rf {} +
echo "[dev-clean] Removed generated build and test artifacts"
