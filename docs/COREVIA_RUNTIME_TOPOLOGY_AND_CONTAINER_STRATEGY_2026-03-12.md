# COREVIA Runtime Topology And Container Strategy

Date: 2026-03-12
Status: proposed working architecture memo
Scope: runtime topology, deployable units, extraction candidates, container strategy

## Executive Decision

COREVIA should continue operating as a modular monolith at the code level and a small set of honest runtime units at the deployment level.

That means:

- one primary `api` runtime remains the canonical interactive workload,
- `postgres` and `redis` remain separate stateful dependencies,
- a separate `processing-worker` runtime is the next justified extraction,
- an `ai-gateway` runtime is valid only when Engine A local inference is a real operating requirement,
- domain, application, infrastructure, and platform layers remain code boundaries inside deployable runtimes, not one-container-per-layer deployment units.

This aligns with the current runtime evidence in `infrastructure/docker/`, the single API image in `infrastructure/docker/api.Dockerfile`, the deployment guidance in `docs/K8S_DEPLOYMENT.md`, and the processing-runtime separation direction in `docs/adr/0016-separate-worker-runtime-for-background-jobs.md`.

## Why COREVIA Does Not Need Container-Per-Layer Packaging

Container boundaries should represent operational boundaries, not conceptual folders.

For COREVIA today:

- `domains/`, `platform/`, `interfaces/`, and `brain/` are in-process architecture boundaries,
- the API runtime serves HTTP, sessions, websocket traffic, frontend hosting, and synchronous orchestration from one Node process,
- the current production guidance explicitly says to deploy COREVIA as a single API-centric application workload,
- the source-structure target reinforces `api -> application -> domain -> infrastructure` as an internal layering rule, not a deployment split rule.

Creating separate containers for application layer, infrastructure layer, or domain layer right now would introduce network hops, distributed failure modes, and operational complexity without a real scaling or ownership benefit.

## Verified Current-State Runtime Topology

### Runtime units that exist now

1. `api`
2. `database`
3. `cache`
4. optional `ai-gateway`
5. optional model-serving profile components: `model-importer`, `model-runtime`, `local-llm`, `local-llm-model-pull`

### Evidence

- `infrastructure/docker/api.Dockerfile` builds one application image and runs `dist/index.js`.
- `apps/api/bootstrap/server.ts` starts the API server, boots module infrastructure, and currently also starts the queue worker.
- `apps/api/bootstrap/appFactory.ts` shows the API also hosts the frontend in production via `serveStatic(app)` and uses Vite only in development.
- `docs/K8S_DEPLOYMENT.md` explicitly says: deploy COREVIA as a single API-centric workload, keep PostgreSQL and Redis separate, and do not model the current platform as per-domain microservices.
- `docs/ENGINE_A_LOCAL_INFERENCE.md` shows `ai-gateway` as an optional stable contract for sovereign local inference, not a mandatory baseline runtime.

### Important current-state observation

The API runtime currently owns too much lifecycle responsibility:

- request/response serving,
- frontend hosting,
- websocket endpoint ownership,
- session and security middleware,
- bootstrap seeding and startup tasks,
- queue worker initialization.

That is acceptable for a modular monolith baseline, but it is the main reason the next runtime split should be `processing-worker`, not per-domain containers.

## Target Professional Runtime Topology

### Phase A: current durable target

```text
Users / Browsers
        |
        v
     Ingress
        |
        v
      API Runtime
        |
   +----+----+
   |         |
   v         v
PostgreSQL  Redis
```

Use this topology when:

- asynchronous load is low or moderate,
- queue work is still operationally coupled to API traffic,
- local inference is optional,
- frontend remains served by the API runtime.

### Phase B: recommended near-term target

```text
Users / Browsers
        |
        v
     Ingress
        |
        v
      API Runtime  <-------------------+
        |                              |
   +----+----+                         |
   |         |                         |
   v         v                         |
PostgreSQL  Redis  <---- Queue ---- Processing-Worker Runtime
```

Use this topology when:

- queue-backed background work is operationally meaningful,
- API startup should no longer own worker lifecycle,
- background processing needs independent restart and scale controls,
- BullMQ backlog and job failure domains need explicit ownership.

### Phase C: optional sovereignty/AI topology

```text
Users / Browsers
        |
        v
     Ingress
        |
        v
      API Runtime  ------------------> AI Gateway
        |                                 |
   +----+----+                            v
   |         |                        Local model runtime
   v         v                        or Ollama / compatible backend
PostgreSQL  Redis
             ^
             |
           Processing-Worker
```

Use this topology when:

- Engine A must be a stable sovereign runtime contract,
- local model hosting changes independently from the main API,
- model-serving health and scaling must be isolated from the API.

## Runtime Boundary Principles

Add a container only when at least one of these is true:

1. The runtime scales differently from the API.
2. The runtime has a different failure domain.
3. The runtime needs separate secrets, health checks, or network policy.
4. The runtime has a different release cadence.
5. The runtime has materially different resource usage such as CPU, memory, or GPU.
6. The runtime is owned operationally by a different team or control plane.

Do not add a container just because code lives in a different layer or folder.

## Candidate Runtime Extractions

### 1. Processing-worker runtime

Status: strongest candidate, recommended next extraction

Why it is justified:

- `docs/adr/0016-separate-worker-runtime-for-background-jobs.md` already identifies this as the next runtime boundary.
- `apps/api/bootstrap/server.ts` currently initializes the vendor proposal processing worker during API startup.
- `platform/queue/vendorProposalProcessingQueue.ts` shows a real BullMQ-backed background execution path.
- Redis-backed queue depth is already exposed in observability.

What should move:

- queue worker bootstrap,
- BullMQ worker process lifecycle,
- future long-running or retry-heavy background jobs,
- job-specific health and lag monitoring.

What should stay in API:

- job enqueue commands,
- synchronous business workflows,
- request/response orchestration,
- websocket and session lifecycle.

Decision: create the dedicated `processing-worker` runtime before any broader service split.

### 2. Knowledge ingestion on worker

Status: recommended use of the existing `processing-worker` runtime

Why it is justified:

- knowledge ingestion already includes document parsing, OCR, chunking, embeddings, duplicate detection, and graph processing under `domains/knowledge/infrastructure/`,
- those tasks are asynchronous, retryable, and materially heavier than live query answering,
- they fit the `processing-worker` runtime better than the API request path.

Decision: move document ingestion and indexing workloads onto the worker while keeping live RAG retrieval in the API.

### 3. AI gateway runtime

Status: valid optional runtime, not mandatory for every environment

Why it is justified when enabled:

- `apps/ai-service/index.ts` implements a stable `/internal-llm/*` contract.
- `docs/ENGINE_A_LOCAL_INFERENCE.md` explicitly recommends using `ai-gateway` as the stable integration point for Engine A.
- model backends can vary independently between Ollama, OpenAI-compatible gateways, and local GGUF-serving runtimes.

What it buys:

- stable Brain-to-LLM contract,
- independent health and timeout policy,
- model runtime swap without API refactor,
- cleaner sovereignty posture for Engine A.

Decision: keep `ai-gateway` as profile-driven and promote it to a standard runtime only in environments where sovereign local inference is operationally required.

### 4. TTS gateway runtime

Status: justified direction, implementation gated by missing backend synthesis asset

Why it is justified:

- server-side TTS under `platform/tts/edge.ts` has a different dependency and performance profile from the API,
- it depends on Python execution and a synthesis backend script,
- it should not remain in the core API hot path as a durable production model.

Decision: package server-side TTS as a dedicated `tts-gateway` runtime once the missing synthesis backend is restored or replaced.

### 5. Web runtime

Status: not yet justified

Why not yet:

- `apps/api/bootstrap/appFactory.ts` shows the API serves frontend assets in production.
- `infrastructure/docker/api.Dockerfile` builds both client and server in one image.
- there is no separate web deployment contract, ingress policy, or release flow defined today.

When it becomes justified:

- CDN-first static hosting is required,
- frontend and backend need separate release cadence,
- the web tier needs independent edge, WAF, or caching policy,
- the org wants a hard separation between SPA hosting and API runtime.

Decision: do not create a `web` runtime yet unless the delivery model changes to real static-site hosting or edge deployment.

### 6. Per-domain services

Status: not justified

Why not:

- current domain boundaries are code ownership boundaries inside a modular monolith,
- no evidence yet of domain-specific scaling, release cadence, or team autonomy that requires service extraction,
- the deployment docs explicitly reject per-domain microservice modeling for the current platform.

Decision: do not split `demand`, `portfolio`, `governance`, `knowledge`, `intelligence`, or other bounded contexts into standalone containers now.

## Recommended Container Strategy By Environment

### Local development

Default:

- `api`
- `database`
- `cache`

Optional profiles:

- `ai-gateway`
- `ollama` or `model-runtime`

Guidance:

- keep local dev simple,
- allow `ENABLE_REDIS=false` or non-Docker local DB paths for developer recovery,
- do not require a worker container until the worker entrypoint actually exists.

### Staging

Recommended target:

- `api`
- `processing-worker` once implemented
- managed or containerized `postgres`
- managed or containerized `redis`
- optional `ai-gateway` only when testing Engine A local inference paths

Guidance:

- staging should validate real background-job isolation before production,
- health and readiness checks should distinguish API readiness from worker readiness,
- release gates should include queue backlog and job execution checks.

### Production

Recommended target:

- `api` deployment
- `processing-worker` deployment
- managed PostgreSQL
- managed Redis
- optional `ai-gateway` deployment for sovereign inference environments
- model-serving runtime only in environments where local inference is required

Guidance:

- keep API stateless aside from session coordination and shared stores,
- keep Redis durable and operationally visible,
- isolate AI runtime network policy and secrets from core API concerns,
- prefer managed stateful services over self-hosted containers where platform maturity allows.

## Rollout Plan

### Workstream 1: formalize the runtime model

1. Mark `api + postgres + redis` as the current canonical baseline.
2. Keep `ai-gateway` explicitly optional and profile-driven.
3. Keep ADR-0016 aligned with the now-real `processing-worker` implementation.

### Workstream 2: introduce the processing-worker runtime

1. Create and maintain the dedicated `processing-worker` bootstrap entrypoint.
2. Move queue-worker startup out of `apps/api/bootstrap/server.ts`.
3. Add `worker.Dockerfile` only when the entrypoint is real.
4. Add Compose and Helm manifests for `processing-worker` health, env, and rollout.
5. Add `processing-worker`-specific metrics: queue lag, retry count, failure rate, throughput.

### Workstream 3: harden operational boundaries

1. Separate API and `processing-worker` readiness criteria.
2. Separate restart policy and autoscaling policy.
3. Add release and rollback steps for `processing-worker` deployment order.
4. Add queue-drain and replay procedures to runbooks.

### Workstream 4: decide on web separation only if the product model changes

1. Define whether the SPA remains API-hosted or moves to CDN/static hosting.
2. If static hosting is chosen, create a real `web` deployable artifact and ingress/CDN plan.
3. Do not create a `web` container before that decision is made.

### Workstream 5: govern AI runtime promotion

1. Keep `ai-gateway` optional until Engine A is required in a target environment.
2. Standardize timeout, health, and model-provider policies.
3. Isolate AI secrets, model runtime config, and network egress policy from the core API.

## Acceptance Criteria For A New Runtime

A new container is acceptable only when all of the following are true:

1. It has a dedicated entrypoint.
2. It has a dedicated health contract.
3. It has environment and secret requirements distinct from the API.
4. It has an operational owner.
5. It improves scale, resilience, sovereignty, or release control enough to justify added complexity.
6. It has release and rollback steps documented.

## Explicit Decisions

1. Keep COREVIA as a modular monolith, not a microservice mesh.
2. Treat code layers as internal architecture boundaries, not automatic container boundaries.
3. Add the `processing-worker` runtime next.
4. Keep `ai-gateway` optional until the environment requires sovereign local inference as a first-class runtime.
5. Delay any `web` split until frontend hosting becomes an independent operating concern.
6. Reject per-domain containerization for the current platform phase.

## Risks If We Ignore This Direction

1. The API remains overloaded with interactive and background lifecycle concerns.
2. Future service splits may happen for cosmetic reasons rather than real operational boundaries.
3. AI runtime sprawl may appear without a controlled contract boundary.
4. Operational complexity may increase without improving resilience or scale.

## Recommended Next Moves

1. Keep ADR-0016 implemented through the `processing-worker` entrypoint.
2. Keep Compose and Helm aligned with the `processing-worker` runtime contract.
3. Keep the current API-centric deployment as the canonical baseline plus `processing-worker` for queue-backed workloads.
4. Reassess `web` separation only if static hosting or edge delivery becomes a product requirement.
5. Reassess `ai-gateway` promotion per environment based on sovereignty and model-hosting needs.