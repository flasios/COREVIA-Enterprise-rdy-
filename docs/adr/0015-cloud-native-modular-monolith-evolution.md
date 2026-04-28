# ADR-0015: Cloud-Native Modular Monolith Evolution Before Selective Service Extraction

> **Status:** accepted
>
> **Date:** 2026-03-10
>
> **Deciders:** Founder Office, Platform Architecture, DevOps Lead

## Context

COREVIA targets enterprise and government deployment environments that expect modern operational standards: containerization, infrastructure automation, observability, controlled release management, and scalability.

At the same time, COREVIA's domain model remains tightly connected across demand, governance, approvals, artifact versioning, architecture, knowledge, and portfolio conversion. Premature microservice decomposition would increase operational complexity before the business model is structurally stable enough to justify it.

## Decision

We adopt a **cloud-native modular monolith evolution model**.

This means:

- the primary runtime remains a modular monolith in the near term,
- the deployment target remains containerized and Kubernetes-oriented,
- stateful services such as PostgreSQL and Redis remain external managed platform dependencies,
- observability, queueing, cache, configuration, and release automation are treated as mandatory cloud-native platform capabilities,
- service extraction is allowed only when justified by compliance isolation, scaling profile, release independence, or blast-radius evidence.

In other words, COREVIA follows cloud-native design without adopting microservices as an ideology.

## Consequences

### Positive

- COREVIA gains cloud-native operational benefits without premature distributed-system cost.
- Teams can preserve transaction and workflow coherence while hardening deployment maturity.
- Future extraction decisions stay evidence-based rather than fashion-driven.
- Platform services such as observability, CI/CD, IaC, and security controls can mature independently of service fragmentation.

### Negative

- Some scaling remains coarse-grained until selective extraction begins.
- Operational concerns in one runtime can still affect multiple domains.
- Teams must actively resist the temptation either to over-split too early or to avoid extraction too long.

### Neutral

- Existing modular boundaries, ports, and public contracts remain the preparation layer for later extraction.
- Worker-style separation for heavy asynchronous jobs remains compatible with this decision and does not require full service decomposition.