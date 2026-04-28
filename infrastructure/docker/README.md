# Docker Surface

Canonical docker-facing runtime assets live under `infrastructure/docker`.

This Compose surface is the canonical local and staging Docker runtime for COREVIA.

This repository is now host-first for local Docker usage. The legacy VS Code Dev Container setup has been removed so the visible Docker runtime is the `corevia-platform` Compose stack rather than a separate workspace container.

Project name: `corevia-platform`

Primary services:

- `api` — COREVIA application runtime
- `processing-worker` — COREVIA background job runtime
- `database` — PostgreSQL with `pgvector`
- `cache` — Redis

Optional intelligence services:

- `engine-a-gateway`
- `model-importer`
- `model-runtime`
- `local-llm`
- `local-llm-model-pull`

This Compose surface runs the API in production mode. Set `SESSION_SECRET`, `POSTGRES_PASSWORD`, and `METRICS_AUTH_TOKEN` before starting it.

The canonical local workflow is:

```bash
npm run docker:boot
```

The recommended baseline now includes the worker runtime:

```bash
npm run docker:boot
```

`npm run docker:boot` uses the repository `.env.docker` or falls back to `.env.docker.example`, stops optional intelligence services such as `engine-a-gateway` and `engine-c-distillation`, rebuilds the app images, and starts the canonical baseline stack: `api + processing-worker + database + cache`.

Run direct `docker compose` commands from `infrastructure/docker/` only when you intentionally need a non-baseline profile.

Current canonical files:

- `api.Dockerfile`
- `worker.Dockerfile`
- `docker-compose.yml`
- `postgres/init/`

Current active container topology is modular-monolith-oriented:

- api container
- processing-worker container
- PostgreSQL container
- Redis container

The API no longer needs to own queue-worker lifecycle in Compose. `api` runs with `COREVIA_INLINE_WORKER=false`, and asynchronous vendor proposal processing runs in the dedicated `processing-worker` runtime.

By default, Engine A is left unconfigured in Compose. To enable it, start the `ai` profile and set `COREVIA_ENGINE_A_ENDPOINT=http://engine-a-gateway:8080`.

Optional local inference topology is now available behind the `ai` Compose profile:

- `engine-a-gateway` container exposing the `/internal-llm/*` contract used by Engine A
- compatible with an Ollama backend or an OpenAI-compatible local model gateway

Optional embedded model topology is now available behind the `model-image` Compose profile:

- `model-importer` build step that copies a `.gguf` model file out of a Docker image into a named volume
- `model-runtime` serving that extracted model through an OpenAI-compatible HTTP API on port `8000`

Typical usage when your Phi model already exists as a Docker image:

```bash
SESSION_SECRET=replace-with-32-plus-char-secret \
POSTGRES_PASSWORD=replace-with-db-password \
METRICS_AUTH_TOKEN=replace-with-24-plus-char-token \
COREVIA_ENGINE_A_ENDPOINT=http://engine-a-gateway:8080 \
LOCAL_LLM_PROVIDER=openai-compatible \
LOCAL_LLM_BASE_URL=http://model-runtime:8000/v1 \
LOCAL_LLM_MODEL_IMAGE=docker.io/phi4:14B-Q4_0 \
docker compose --profile ai --profile model-image up -d model-importer model-runtime engine-a-gateway api processing-worker database cache
```

If the imported image contains multiple files, set `LOCAL_LLM_MODEL_FILE_PATTERN` or `LOCAL_LLM_MODEL_FILENAME` so the extractor picks the correct `.gguf` payload.

Optional local LLM topology is also available behind the `local-llm` Compose profile:

- `local-llm` runs the local model runtime inside the same Docker daemon as COREVIA
- `local-llm-model-pull` downloads the configured primary, fast, and alternate local models into the shared local-LLM volume using the current Ollama backend

Typical usage:

```bash
SESSION_SECRET=replace-with-32-plus-char-secret \
POSTGRES_PASSWORD=replace-with-db-password \
METRICS_AUTH_TOKEN=replace-with-24-plus-char-token \
COREVIA_ENGINE_A_ENDPOINT=http://engine-a-gateway:8080 \
LOCAL_LLM_PROVIDER=ollama \
LOCAL_LLM_BASE_URL=http://local-llm:11434 \
LOCAL_LLM_DEFAULT_MODEL=mistral-nemo \
COREVIA_ENGINE_A_FAST_MODEL=qwen2.5:7b \
LOCAL_LLM_PULL_MODELS="mistral-nemo qwen2.5:7b" \
docker compose --profile ai --profile local-llm up -d local-llm engine-a-gateway api processing-worker database cache && \
docker compose --profile local-llm up local-llm-model-pull
```

Minimal local API stack without Engine A:

```bash
npm run docker:up:core
```

This baseline command rebuilds the app images, starts only the required core services, and stops optional AI profile containers such as `engine-a-gateway`, `engine-a-runpod-gateway`, and `local-llm` so stale optional health states do not pollute the production-style core runtime.

Enable the optional Engine A gateway layer only when you are intentionally running an Engine A local-inference profile:

```bash
npm run start:docker:gateway
```

The RunPod gateway exposes `/internal-llm/live` for container liveness and `/internal-llm/ready` or `/internal-llm/health` for backend readiness. A live gateway can still report backend readiness failures when the rented GPU endpoint is paused, missing credentials, or not exposing an OpenAI-compatible `/v1/models` route.

The top-level terminal entrypoints are:

```bash
npm run start:docker
npm run start:docker:gateway
```

If port `5001`, `5002`, `5432`, or `6379` is already in use on the host, edit `.env` and change `API_HOST_PORT`, `WORKER_HOST_PORT`, `POSTGRES_HOST_PORT`, or `REDIS_HOST_PORT` before starting the stack.

There is no active microservice or standalone gateway Docker topology in the current system.

Reserved names like `web.Dockerfile` and `ai.Dockerfile` should only be added when those become real deployable runtimes.

Likely future runtime additions, only when they become real processes:

- `web` only if the frontend becomes a separately deployed runtime
