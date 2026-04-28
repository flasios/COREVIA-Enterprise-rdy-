# ADR-0016: Separate Worker Runtime For Heavy Background Jobs

> **Status:** accepted
>
> **Date:** 2026-03-11
>
> **Deciders:** Platform Architecture, DevOps Lead, Application Architecture

## Context

COREVIA currently runs as a modular monolith with a monolith-oriented active container topology: `api`, PostgreSQL, and Redis.

That remains the correct primary architecture. ADR-0015 explicitly keeps COREVIA on a cloud-native modular monolith path and allows worker-style separation for heavy asynchronous jobs without requiring premature microservice decomposition.

At the same time, background job execution is already a real runtime concern in the implementation:

- the API bootstrap currently initializes the vendor proposal processing worker during API startup,
- BullMQ and Redis are already used for queue-backed asynchronous processing,
- the current queue implementation can fall back to synchronous processing when Redis is unavailable,
- the Docker runtime documentation already reserved a background-processing runtime as the next legitimate isolated execution surface.

This created an architectural mismatch between deployment shape and runtime responsibilities. The API process owned both request/response serving and queue-worker lifecycle. That coupling increased startup responsibility, mixed interactive and asynchronous workload concerns, and made operational scaling coarse-grained.

The issue is not that COREVIA needs microservices now. The issue is that heavy or long-running asynchronous work should no longer be forced to share the same runtime lifecycle, scaling profile, and failure domain as the main API process once background processing becomes operationally meaningful.

## Decision

We introduce a **separate background-processing runtime for heavy jobs** while preserving COREVIA's primary modular monolith architecture.

This means:

- the API runtime remains the canonical interactive runtime for HTTP, sessions, frontend hosting, and synchronous application workflows,
- queue-backed background execution moves to a distinct `processing-worker` runtime when the workload is materially asynchronous or operationally significant,
- Redis-backed job processing remains the control mechanism for asynchronous execution,
- worker separation is selective and pragmatic, not a blanket extraction pattern,
- introducing the `processing-worker` runtime does not imply domain decomposition into standalone services.

Implementation direction:

- the current in-process worker boot path is transitional,
- worker bootstrap logic moves behind a dedicated runtime entrypoint,
- Docker and deployment assets add the canonical `processing-worker` runtime because it is now a real deployable process,
- release, health, observability, and rollback procedures must explicitly account for the `processing-worker` runtime once introduced,
- background workloads that remain lightweight or latency-sensitive may continue inline until their operational profile justifies queue execution.

## Consequences

### Positive

- API startup becomes cleaner because request-serving concerns are separated from background job lifecycle concerns.
- Heavy asynchronous work can scale independently from interactive traffic.
- Queue processing failures or backlogs can be isolated operationally instead of sharing the same runtime blast radius as the API.
- Deployment topology becomes more honest about the system's real runtime responsibilities.
- The architecture stays aligned with ADR-0015 by allowing selective worker separation without premature service fragmentation.

### Negative

- Deployment and release management become more complex because an additional runtime must be built, configured, deployed, monitored, and rolled back.
- Operational documentation, health strategy, and on-call procedures must expand to cover worker-specific failure modes.
- Some existing bootstrapping and queue ownership code will need refactoring to remove API-runtime assumptions.
- Teams may overuse worker extraction unless the boundary remains governed by explicit criteria.

### Neutral

- COREVIA remains a modular monolith; this decision changes runtime topology for selected workloads, not the core product architecture.
- Redis remains a required platform capability for queue-backed execution where worker separation is used.
- Not every background action needs a dedicated worker immediately; this is a selective operating model, not a mandatory rewrite.

## Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
|-------------|------|------|----------------|
| Keep all workers inside the API runtime | Lowest short-term change cost; simplest local topology | Mixes interactive and background concerns; coarse scaling; larger startup surface; shared failure domain | Acceptable only as a transitional state, not as the durable target for heavier async workloads |
| Introduce a separate worker runtime selectively | Preserves monolith simplicity while isolating heavy async execution; aligns with current queue architecture and Docker direction | Adds runtime, deployment, and operational complexity | Chosen because it solves the real operational boundary without forcing premature microservices |
| Extract background processing into a standalone microservice domain now | Strong isolation and independent lifecycle | Premature service split; higher coordination and deployment complexity; weak evidence that full service decomposition is required yet | Not chosen because the current need is runtime isolation, not full domain/service extraction |
| Avoid queue-backed workers and run async work synchronously or ad hoc | Simplest conceptual model | Poor fit for heavy or long-running jobs; harms API responsiveness and resilience; ignores existing Redis/BullMQ investment | Not chosen because the implementation already demonstrates a real queue-backed background workload |