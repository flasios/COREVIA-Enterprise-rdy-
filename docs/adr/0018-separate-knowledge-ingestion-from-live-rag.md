# ADR-0018: Separate Knowledge Ingestion From Live RAG Query Serving

> **Status:** accepted
>
> **Date:** 2026-03-12
>
> **Deciders:** Enterprise Architecture, Platform Architecture, Knowledge Domain Lead

## Context

COREVIA's knowledge capability currently contains two materially different workload types:

- interactive RAG query serving,
- asynchronous document ingestion and indexing.

The implementation evidence shows that knowledge ingestion includes document parsing, OCR, chunking, embedding generation, duplicate detection, and graph processing under `domains/knowledge/infrastructure/`.

Those tasks are computationally heavier, more retryable, and more operationally variable than synchronous query answering.

At the same time, live RAG query serving remains latency-sensitive and should stay close to the API request path while COREVIA is still operating as a modular monolith.

## Decision

We will separate **knowledge ingestion** from **live RAG query serving**.

This means:

- the `processing-worker` runtime becomes the target execution surface for document ingestion, OCR, chunking, embedding generation, re-embedding, graph extraction, and reindex jobs,
- the `api` runtime remains the target execution surface for synchronous retrieval, RAG answer orchestration, and interactive knowledge search,
- queue-backed ingestion becomes the canonical model for heavy document-processing workflows,
- live RAG retrieval remains in-process with the API unless scale or latency requirements later justify a dedicated retrieval runtime.

## Consequences

### Positive

- Keeps API latency predictable during document ingestion spikes.
- Makes OCR, chunking, embedding, and graph processing retryable and observable as background jobs.
- Preserves a clean user-facing request path for interactive RAG.
- Avoids premature extraction of a retrieval microservice.

### Negative

- Adds queue orchestration and job-state tracking to the knowledge ingestion flow.
- Requires ingestion progress, failure, and replay handling to be operationalized.

## Explicit non-decision

This ADR does not create a standalone RAG retrieval service. It keeps live retrieval in the API until operating evidence justifies a separate runtime.