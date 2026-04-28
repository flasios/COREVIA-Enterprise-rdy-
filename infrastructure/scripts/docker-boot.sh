#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
script_dir="$repo_root/infrastructure/scripts"
docker_compose_helper="$script_dir/docker-compose.sh"

cd "$repo_root"

source "$script_dir/dev-env.sh"
load_local_dev_defaults
require_command docker "Install Docker Desktop and ensure the docker CLI is on PATH"
require_command curl "Install curl so runtime health checks can run"

optional_services=(
  engine-a-gateway
  engine-a-runpod-gateway
  local-llm
  local-llm-model-pull
  engine-c-distillation
)

if lsof -nP -iTCP:5000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[docker-boot] Host app detected on :5000. Leaving it untouched; Docker API remains the canonical app surface on :5001."
fi

echo "[docker-boot] Stopping optional intelligence services for the baseline runtime..."
"$docker_compose_helper" --profile ai --profile local-llm --profile training stop "${optional_services[@]}" >/dev/null 2>&1 || true

echo "[docker-boot] Starting core Docker runtime..."
"$docker_compose_helper" up -d --build --remove-orphans api processing-worker database cache

echo "[docker-boot] Waiting for API health on :5001..."
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:5001/api/health >/dev/null 2>&1; then
    echo "[docker-boot] API healthy at http://127.0.0.1:5001/api/health"
    break
  fi
  sleep 2
done

if ! curl -fsS http://127.0.0.1:5001/api/health >/dev/null 2>&1; then
  echo "[docker-boot] API failed to become healthy on :5001"
  exit 1
fi

echo "[docker-boot] Waiting for processing worker readiness on :5002..."
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:5002/health/ready >/dev/null 2>&1; then
    echo "[docker-boot] Worker healthy at http://127.0.0.1:5002/health/ready"
    break
  fi
  sleep 2
done

if ! curl -fsS http://127.0.0.1:5002/health/ready >/dev/null 2>&1; then
  echo "[docker-boot] Processing worker failed to become healthy on :5002"
  exit 1
fi

echo "[docker-boot] Core Docker runtime is ready. Open http://127.0.0.1:5001"
