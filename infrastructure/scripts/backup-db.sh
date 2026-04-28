#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

backup_dir="${1:-./backups}"
mkdir -p "$backup_dir"
timestamp="$(date +%Y%m%dT%H%M%S)"
backup_file="$backup_dir/corevia-${timestamp}.dump"

pg_dump "$DATABASE_URL" --format=custom --file "$backup_file"
echo "$backup_file"
