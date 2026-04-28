# ADR-0001: Modular Monolith Over Microservices

> **Status:** accepted
>
> **Date:** 2025-01-15
>
> **Deciders:** Platform Architecture Team

## Context

COREVIA is an enterprise AI governance platform targeting UAE government agencies. We needed to choose between a microservices architecture (each bounded context deployed independently) and a modular monolith (single deployable with strong internal boundaries).

Team size was 1–3 engineers. The domain model spans 12 bounded contexts with significant cross-cutting concerns (versioning, RBAC, AI pipeline). The initial deployment target is a single Kubernetes cluster.

## Decision

We chose a **modular monolith** with:

- 12 domain modules with enforced internal layering (`api/ → application/ → domain/ → infrastructure/`)
- Ports & Adapters storage pattern for future decomposition
- In-process domain event bus for cross-module communication
- Docker Compose with 13+ service definitions documenting the future extraction plan
- Architecture boundary checks enforced at CI time

## Consequences

### Positive

- Single deployment unit simplifies operations, debugging, and local development
- No network serialization overhead between modules — latency stays minimal
- Shared database simplifies transactions across bounded contexts
- Refactoring across module boundaries is trivial (IDE rename, not API contract changes)
- Architecture boundary checks prevent coupling drift without the operational cost of separate deployments

### Negative

- All modules share a process — a memory leak in one affects all
- Scaling is all-or-nothing (can't scale AI pipeline independently of auth)
- Future extraction to microservices requires building API contracts and network resilience

### Neutral

- Docker assets can evolve later if operating evidence justifies decomposition, but the current runtime and container model remains a modular monolith
- Module port interfaces serve as the future service API contracts
