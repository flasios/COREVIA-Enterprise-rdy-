#!/usr/bin/env bash
set -euo pipefail

current="$({ grep -R '@ts-nocheck' -rn apps/web brain domains interfaces platform 2>/dev/null || true; } | wc -l | tr -d '[:space:]')"
baseline="${TS_NOCHECK_BASELINE:-$current}"

echo "[ts-nocheck] baseline=$baseline current=$current"

if [[ "$current" -gt "$baseline" ]]; then
  echo "[ts-nocheck] Regression detected: current ($current) > baseline ($baseline)"
  exit 1
fi

echo "[ts-nocheck] OK"
