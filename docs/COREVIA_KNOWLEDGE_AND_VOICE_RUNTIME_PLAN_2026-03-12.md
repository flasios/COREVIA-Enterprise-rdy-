# COREVIA Knowledge And Voice Runtime Plan

Date: 2026-03-12
Status: recommended execution plan
Scope: document ingestion, RAG runtime boundaries, TTS runtime boundaries

## Executive Recommendation

The next recommended runtime topology for COREVIA knowledge and voice capabilities is:

- `api` for interactive RAG query serving and user-facing orchestration,
- `processing-worker` for asynchronous document ingestion and indexing,
- `tts-gateway` for server-side speech synthesis,
- optional `ai-gateway` for Engine A sovereign/local inference,
- `postgres` and `redis` as shared stateful platform dependencies.

## Current-State Assessment

### Knowledge / RAG

Verified implementation evidence shows that the knowledge module currently combines:

- document processing and OCR,
- chunking,
- embeddings generation,
- duplicate detection,
- graph processing,
- interactive retrieval and RAG response generation.

Those concerns do not belong in one operational lane.

### Voice / TTS

Verified implementation evidence shows that:

- browser-side speech recognition already exists in the web client,
- server-side TTS exists conceptually through `platform/tts/edge.ts`,
- the backend script required by that adapter is currently missing from the repository.

That means the TTS runtime direction is clear, but the implementation is not yet ready to package.

## Target Runtime Topology

```text
Users / Browsers
        |
        v
     Ingress
        |
        v
      API Runtime  ----------------------------> TTS Gateway
        |                                           |
        |                                           v
        |                                      Speech backend
        |
        +-------------------- Queue ------------------------+
        |                                                   |
        v                                                   v
   PostgreSQL <-------------------------------------- Processing-Worker Runtime
        ^                                                   |
        |                                                   |
        +---------------------- Redis ----------------------+

Optional: API and `processing-worker` can also call AI Gateway for Engine A local inference.
```

## Runtime Responsibilities

### API runtime

- interactive knowledge search,
- synchronous RAG retrieval and answer assembly,
- user-facing document and briefing APIs,
- orchestration of TTS requests to `tts-gateway`,
- queue enqueue commands for ingestion or reindex work.

### Processing-worker runtime

- document parsing,
- OCR,
- chunk generation,
- embeddings generation,
- duplicate detection jobs,
- graph extraction jobs,
- re-embedding and reindex jobs,
- long-running or retry-heavy knowledge maintenance tasks.

### TTS gateway

- speech synthesis health and provider selection,
- Python/process dependency isolation,
- audio generation timeouts,
- language/voice configuration,
- optional caching for repeated synthesis requests.

## What Should Not Be Done

1. Do not move live RAG query serving into the worker.
2. Do not leave server-side TTS inside the main API runtime as a durable target.
3. Do not create a generic "AI service" that mixes retrieval, ingestion, TTS, and model inference without clear operational boundaries.
4. Do not split knowledge into a standalone microservice yet.

## Workstreams

### Workstream 1: knowledge-ingestion job model

1. Introduce queue-backed job types for document ingestion.
2. Move heavy processing out of upload request paths.
3. Record job state, failure state, and replay paths.
4. Keep the retrieval path synchronous in the API.

### Workstream 2: ingestion observability

1. Add metrics for ingestion duration, failure rate, and backlog.
2. Add document processing stage visibility: extracted, chunked, embedded, indexed, failed.
3. Add replay and dead-letter handling for failed ingestion jobs.

### Workstream 3: TTS gateway recovery

1. Restore or replace the missing synthesis backend script referenced by `platform/tts/edge.ts`.
2. Define the internal HTTP contract for `tts-gateway`.
3. Package the runtime with explicit Python dependency management.
4. Add health, timeout, and voice availability checks.

### Workstream 4: delivery sequencing

1. Implement knowledge-ingestion worker changes first.
2. Keep browser voice features unchanged.
3. Implement `tts-gateway` only after the backend synthesis path is restored.
4. Reassess whether pre-generated long-form audio also needs worker orchestration after the gateway is live.

## Readiness Gates

### Knowledge-ingestion worker gate

1. Upload no longer blocks on full OCR and embedding work.
2. Failed ingestion jobs can be retried without user re-upload.
3. Queue backlog and processing time are visible operationally.
4. Interactive RAG latency remains stable under ingestion load.

### TTS gateway gate

1. Real synthesis backend script or provider exists in the repo.
2. Runtime can boot independently from API.
3. Health and readiness endpoints reflect synthesis availability.
4. Audio generation timeouts and failure responses are bounded and observable.

## Current Blockers

1. The TTS adapter references `scripts/edge_tts_synth.py`, but that file is not present in the repository.
2. The knowledge upload path is still largely synchronous and has not yet been reworked around queue-backed ingestion jobs.

## Recommended Next Move

Implement the knowledge-ingestion worker path first, then restore and package the TTS backend behind a dedicated `tts-gateway` runtime.