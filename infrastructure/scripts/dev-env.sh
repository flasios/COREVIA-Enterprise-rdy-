#!/usr/bin/env bash
set -euo pipefail

NODE_FALLBACK_DIR="$HOME/.local/node-v20.19.0-darwin-arm64/bin"

load_local_dev_defaults() {
  export POSTGRES_USER="${POSTGRES_USER:-postgres}"
  export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-corevia_dev_password}"
  export POSTGRES_DB="${POSTGRES_DB:-heliumdb}"
  export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}}"
}

resolve_node_toolchain() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  if [[ -d "$NODE_FALLBACK_DIR" ]]; then
    export PATH="$NODE_FALLBACK_DIR:$PATH"
  fi

  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1
}

require_command() {
  local command_name="$1"
  local help_message="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$help_message"
    exit 1
  fi
}

print_port_status() {
  for port in "$@"; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "[dev-env] port ${port}: listening"
    else
      echo "[dev-env] port ${port}: free"
    fi
  done
}