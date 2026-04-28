#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
script_dir="$repo_root/infrastructure/scripts"

cd "$repo_root"

source "$script_dir/dev-env.sh"
load_local_dev_defaults
resolve_node_toolchain || require_command node "Install Node.js 20+ or place it at $HOME/.local/node-v20.19.0-darwin-arm64/bin"
require_command npm "Install npm or place it at $HOME/.local/node-v20.19.0-darwin-arm64/bin"
require_command docker "Install Docker Desktop and ensure the docker CLI is on PATH"

echo "[dev-boot] Starting infrastructure (Postgres + Redis)..."
docker_compose_helper="$script_dir/docker-compose.sh"
"$docker_compose_helper" up -d database cache

echo "[dev-boot] Waiting for Postgres readiness..."
until "$docker_compose_helper" exec -T database pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  sleep 1
done

echo "[dev-boot] Ensuring pgvector extension..."
"$docker_compose_helper" exec -T database psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null

echo "[dev-boot] Applying schema..."
npm run db:push

echo "[dev-boot] Cleaning stale dev process..."
pkill -f "apps/api/index.ts" >/dev/null 2>&1 || true

echo "[dev-boot] Starting app on :5000"
npm run dev
