# COREVIA Runtime Executive One-Pager

Date: 2026-03-12
Audience: architecture leadership, platform leadership, delivery leadership

## Decision Summary

COREVIA should run as a modular monolith with a small number of honest deployable runtimes.

The target operating model is:

- `api` as the primary interactive workload,
- `processing-worker` as the background-job workload,
- `tts-gateway` as the server-side speech synthesis workload,
- `postgres` as the system of record,
- `redis` as the queue and cache dependency,
- optional `ai-gateway` only where sovereign local inference is a real operating requirement.

## Why This Is The Right Professional Shape

The internal architecture layers are already correct as code boundaries. They are not good reasons, by themselves, to create separate containers.

Container boundaries should reflect:

- different scale profile,
- different failure domain,
- different security boundary,
- different release cadence,
- different resource profile.

That is why the next justified split is the `processing-worker` runtime, not container-per-layer packaging.

## Target Runtime Diagram

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
                                |
                                +-------------------------- optional AI Gateway -----------------> Local model runtime
                                |
                                +---------------------------------------------------------------> TTS Gateway
```

## Current Implementation Evidence

- The repo packages one API image in `infrastructure/docker/api.Dockerfile`.
- The worker split is justified by BullMQ-backed vendor proposal processing and ADR-0016.
- The AI gateway already exists as an optional internal contract for Engine A local inference.
- Kubernetes guidance already rejects per-domain microservice deployment for the current platform phase.

## What We Are Doing Now

1. Keep the API as the canonical interactive runtime.
2. Introduce the real `processing-worker` runtime for queue-backed background jobs.
3. Move document ingestion and indexing workloads to the worker, while keeping live RAG query serving in the API.
4. Package server-side TTS behind a dedicated `tts-gateway` runtime once the synthesis backend is restored.
5. Keep `ai-gateway` optional and environment-driven.
6. Do not split `web` until frontend hosting becomes an independent operational concern.
7. Do not split domains into separate services unless operating constraints justify it.

## Business Value

- Cleaner API startup and smaller interactive failure domain.
- Independent scaling for background work.
- Better production honesty: runtime boundaries match actual workload boundaries.
- Lower risk than premature microservice decomposition.
- Stronger path to sovereign AI deployment without destabilizing the core API.

## Executive Recommendation

Approve the `api + worker + postgres + redis` target as the standard production topology, with `ai-gateway` enabled selectively by environment.