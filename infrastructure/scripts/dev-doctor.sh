#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
script_dir="$repo_root/infrastructure/scripts"

cd "$repo_root"

source "$script_dir/dev-env.sh"
load_local_dev_defaults

if ! resolve_node_toolchain; then
  echo "[dev-doctor] node/npm not found on PATH and no supported local fallback was found"
else
  echo "[dev-doctor] Using node: $(command -v node) ($(node -v))"
  echo "[dev-doctor] Using npm: $(command -v npm) ($(npm -v))"
fi

if command -v docker >/dev/null 2>&1; then
  echo "[dev-doctor] Using docker: $(command -v docker)"
  docker --version || true
  docker compose version || true
else
  echo "[dev-doctor] Docker CLI not found on PATH"
fi

echo "[dev-doctor] Checking Docker services..."
if command -v docker >/dev/null 2>&1; then
  bash "$script_dir/docker-compose.sh" ps database cache || true
else
  echo "[dev-doctor] Skipping docker compose ps because docker is unavailable"
fi

echo "[dev-doctor] Checking ports..."
print_port_status 5432 6379 5000 5001

echo "[dev-doctor] Checking app endpoint..."
if curl -sS -o /dev/null -w '%{http_code}' http://localhost:5001/api/health | grep -q '^200$'; then
  echo "[dev-doctor] Docker API is healthy on http://localhost:5001/api/health"
elif curl -sS -o /dev/null -w '%{http_code}' http://localhost:5000/ | grep -q '^200$'; then
  echo "[dev-doctor] Local dev app is healthy on http://localhost:5000"
else
  echo "[dev-doctor] Neither the Docker API (:5001) nor the local dev app (:5000) responded with 200"
fi

echo "[dev-doctor] Done"
