# Engine A Local Inference

COREVIA Engine A is a sovereign local-inference role. It now supports an optional dedicated `engine-a-gateway` runtime that exposes the internal contract expected by the Brain:

- `GET /internal-llm/health`
- `POST /internal-llm/generate`

## Recommended Topology

Use `engine-a-gateway` as the stable integration point and place your actual local model runtime behind it.

This keeps the Brain contract stable even if you switch between:

- Ollama
- an OpenAI-compatible local gateway
- a future dedicated model-serving container
- a Docker-image-based GGUF model served by `llama.cpp`

## Compose Usage

Start the optional local inference profile:

```bash
SESSION_SECRET=replace-with-32-plus-char-secret \
POSTGRES_PASSWORD=replace-with-db-password \
METRICS_AUTH_TOKEN=replace-with-24-plus-char-token \
COREVIA_ENGINE_A_ENDPOINT=http://engine-a-gateway:8080 \
cd infrastructure/docker && docker compose --env-file ../../.env.docker.example --profile ai up -d engine-a-gateway api processing-worker database cache
```

Start the embedded Docker-image model path when your model already exists as a local Docker image:

```bash
SESSION_SECRET=replace-with-32-plus-char-secret \
POSTGRES_PASSWORD=replace-with-db-password \
METRICS_AUTH_TOKEN=replace-with-24-plus-char-token \
COREVIA_ENGINE_A_ENDPOINT=http://engine-a-gateway:8080 \
LOCAL_LLM_PROVIDER=openai-compatible \
LOCAL_LLM_BASE_URL=http://model-runtime:8000/v1 \
LOCAL_LLM_MODEL_IMAGE=docker.io/phi4:14B-Q4_0 \
cd infrastructure/docker && docker compose --env-file ../../.env.docker.example --profile ai --profile model-image up -d model-importer model-runtime engine-a-gateway api processing-worker database cache
```

Start the in-project local LLM path when you want the workspace Docker daemon to host the model directly:

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
cd infrastructure/docker && docker compose --env-file ../../.env.docker.example --profile ai --profile local-llm up -d local-llm engine-a-gateway api processing-worker database cache && \
docker compose --env-file ../../.env.docker.example --profile local-llm up local-llm-model-pull
```

## Environment Variables

`api` service:

- `COREVIA_ENGINE_A_ENDPOINT`: set to `http://engine-a-gateway:8080` when the `ai` profile is enabled; left empty by default so the API reports Engine A as unconfigured instead of pointing at a missing container
- `COREVIA_ENGINE_A_MODEL` default: `mistral-nemo`
- `COREVIA_ENGINE_A_FAST_MODEL` default: `qwen2.5:7b`
- `COREVIA_ENGINE_A_ALT_ENABLED` default: `false`
- `COREVIA_ENGINE_A_ALT_PLUGIN_ID` default: `engine-sovereign-qwen25-7b`
- `COREVIA_ENGINE_A_ALT_NAME` default: `Qwen 2.5 7B Sovereign Engine`
- `COREVIA_ENGINE_A_ALT_MODEL` default: `qwen2.5:7b`
- `COREVIA_ENGINE_A_ALT_FAST_MODEL` default: `qwen2.5:7b`
- `COREVIA_ENGINE_A_ALT_ENDPOINT`: optional override; if unset, the alternate plugin inherits `COREVIA_ENGINE_A_ENDPOINT`

`engine-a-gateway`:

- `LOCAL_LLM_PROVIDER`: `ollama` or `openai-compatible`
- `LOCAL_LLM_BASE_URL`: upstream model endpoint; in local Docker the default local-LLM path now points to `http://local-llm:11434`
- `LOCAL_LLM_API_KEY`: optional for OpenAI-compatible backends
- `LOCAL_LLM_DEFAULT_MODEL`: default upstream model

Embedded model profile:

- `LOCAL_LLM_MODEL_IMAGE`: Docker image that contains the downloaded GGUF model
- `LOCAL_LLM_MODEL_FILE_PATTERN`: optional pattern used when extracting the model file
- `LOCAL_LLM_MODEL_FILENAME`: filename written into the shared model volume, default `model.gguf`
- `LOCAL_LLM_CONTEXT_SIZE`: llama.cpp context size, default `8192`
- `LOCAL_LLM_GPU_LAYERS`: llama.cpp GPU offload layers, default `0`

Local LLM profile:

- `LOCAL_LLM_DEFAULT_MODEL`: model tag pulled into the local LLM container, default `mistral-nemo`
- `LOCAL_LLM_BASE_URL`: set to `http://local-llm:11434` when `engine-a-gateway` is calling the in-project local LLM container
- `LOCAL_LLM_PULL_MODELS`: optional space-separated Ollama tags to bootstrap; if unset, the pull job uses the primary, fast, and alternate Engine A model tags

## Dual-Model Recommendation

Recommended local split:

- keep `mistral-nemo` as `COREVIA_ENGINE_A_MODEL` for heavier business case and requirements drafts
- use `qwen2.5:7b` as `COREVIA_ENGINE_A_FAST_MODEL` for demand-field generation and other latency-sensitive structured JSON tasks
- enable the alternate sovereign plugin when you want to test or explicitly route to the 7B model without losing the current default

This keeps the current model in place while giving Engine A a lighter 7B option for faster structured generation.

## Mistral Nemo Recommendation

Use Mistral Nemo as the default sovereign plugin when your local Docker host has enough memory for a 12B quantized model.

Suggested rollout:

1. Enable `engine-a-gateway`.
2. Either point `LOCAL_LLM_BASE_URL` to your local model server, run the `model-image` profile and point `LOCAL_LLM_BASE_URL` to `http://model-runtime:8000/v1`, or run the `local-llm` profile and point it to `http://local-llm:11434`.
3. Set `COREVIA_ENGINE_A_ALT_ENABLED=true`.
4. Test the alternate plugin with:

```bash
curl -X POST http://localhost:5000/api/corevia/engines/engine-a/test \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Return JSON with status and message confirming readiness."}'
```

## Important Constraint

The Docker image you imported into Docker Desktop is not automatically usable by COREVIA just because the model exists locally.

COREVIA needs a running HTTP-serving model backend. If the imported image does not expose an Ollama-style or OpenAI-compatible inference API, you still need a serving layer in front of the raw model.

The new `model-image` profile provides that serving layer for GGUF-style images by extracting the model file and hosting it with `llama.cpp`.

If the model image in Docker Desktop is not visible from this workspace daemon, the `local-llm` profile is the more reliable option because it downloads the model directly into the same daemon COREVIA uses.