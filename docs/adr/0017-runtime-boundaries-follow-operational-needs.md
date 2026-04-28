# ADR-0017: Runtime Boundaries Follow Operational Needs, Not Code Layers

> **Status:** accepted
>
> **Date:** 2026-03-12
>
> **Deciders:** Platform Architecture, Enterprise Architecture, DevOps Lead

## Context

COREVIA enforces strong internal architecture layers and bounded contexts across `apps/`, `domains/`, `platform/`, `interfaces/`, and `brain/`.

Those are necessary code boundaries, but they are not automatically deployment boundaries.

The repository's documented deployment model, Docker assets, and Kubernetes notes all converge on a modular-monolith-first operating model. The actual runtime split now justified by implementation evidence is selective runtime extraction, beginning with the `processing-worker` runtime for queue-backed jobs and using `ai-gateway` only where sovereign local inference is a real operating need.

## Decision

We will draw runtime boundaries according to operational needs rather than according to source-code layer names.

That means:

- domain, application, infrastructure, and platform layers stay as internal code boundaries,
- containers are added only when they represent a real operational boundary,
- the default COREVIA topology remains API-centric,
- processing-worker-style and gateway-style runtimes are valid when they isolate distinct lifecycle, scale, or sovereignty concerns,
- per-layer or per-domain service splits are rejected unless justified by operating constraints.

## Runtime boundary criteria

A new runtime is justified only when one or more of the following is true:

1. It needs independent scaling.
2. It needs an independent failure domain.
3. It needs distinct secrets, network policy, or compliance controls.
4. It needs a different release cadence.
5. It has materially different CPU, memory, or GPU demand.
6. It has a separate operational owner.

## Consequences

### Positive

- Prevents cosmetic microservice sprawl.
- Keeps the modular monolith intact where it is still the correct model.
- Makes runtime topology honest and easier to operate.
- Provides a clear decision rule for future `processing-worker`, `web`, or AI runtime additions.

### Negative

- Some teams may perceive the topology as less "enterprise-looking" than a larger service map.
- Runtime extraction decisions now require evidence instead of being driven by folder structure or presentation.

## Explicit non-decision

This ADR does not forbid future extraction of `web`, AI, or domain-specific runtimes. It requires that such extraction be justified by real operational boundaries.