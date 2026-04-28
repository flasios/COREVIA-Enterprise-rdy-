#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
env_file="$repo_root/.env.docker"

if [[ ! -f "$env_file" ]]; then
  env_file="$repo_root/.env.docker.example"
fi

cd "$repo_root/infrastructure/docker"
exec docker compose --env-file "$env_file" "$@"