# ADR-0013: Modular Domain Architecture With Explicit Bounded Context Ownership

> **Status:** accepted
>
> **Date:** 2026-03-10
>
> **Deciders:** Platform Architecture, Domain Leads, Founder Office

## Context

COREVIA already uses a module-first backend structure and increasingly module-owned frontend surfaces. The platform spans multiple domains with different change rates, responsibilities, and business rules.

Without an explicit architectural decision, domain boundaries can erode into convenience imports, shared-service sprawl, and ownership ambiguity.

## Decision

We adopt **modular domain architecture with explicit bounded context ownership** as a governing architectural standard.

The primary bounded contexts are:

- Identity
- Demand
- Governance
- Portfolio
- Enterprise Architecture
- Intelligence
- Knowledge
- Compliance
- Integration
- Notifications
- Operations
- Brain / Decision Spine

The governing rules are:

- backend layering remains `api -> application -> domain -> infrastructure`,
- domain behavior is owned inside its bounded context,
- cross-module access occurs via contracts, ports, or explicit public surfaces,
- shared platform services remain technical and cross-cutting only,
- business-domain ownership must not collapse back into generic shared service folders.

## Consequences

### Positive

- Ownership becomes clearer across code, architecture, and operating model.
- Refactors become safer because public surfaces are explicit.
- Service extraction later becomes easier because boundaries are already formalized.
- Enterprise capability mapping can align directly to bounded contexts.

### Negative

- Teams must invest in public-surface design instead of relying on direct access shortcuts.
- Some repeated code may exist temporarily while boundaries are clarified.
- Boundary enforcement may slow down fast local changes that cut across contexts.

### Neutral

- A modular monolith remains compatible with strict bounded-context ownership.
- Shared contracts and ports are encouraged, but shared business logic ownership is not.