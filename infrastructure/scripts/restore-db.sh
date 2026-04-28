#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

backup_file="${1:-}"
if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo "Usage: DATABASE_URL=... $0 <backup-file>" >&2
  exit 1
fi

pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" "$backup_file"
