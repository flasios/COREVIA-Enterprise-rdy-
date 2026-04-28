# COREVIA System Overview

Date: 2026-03-10

## Executive Summary

COREVIA is a governance-first enterprise decision platform.

It is not primarily a workflow app, a document tool, or a generic AI assistant.

Its core operating model is:

- receive enterprise demand,
- route it through governed reasoning,
- produce auditable decision artifacts,
- drive approval and execution continuity,
- learn only from approved outcomes.

## Architectural Reading Order

The system should be understood in this order:

1. `platform`: security, observability, storage, cache, queue, config, logging, AI runtime services
2. `brain`: COREVIA Brain, Decision Spine, governed orchestration, policy-aware reasoning
3. `domains`: bounded contexts that own business capabilities
4. `interfaces`: HTTP, websocket, middleware, route composition, transport adapters
5. `apps`: user-facing client and main API runtime composition

## Current Physical Reality

The current repository already approximates this model.

### Applications

- `apps/web/` is the current web application root
- `apps/api/` is the canonical backend application entrypoint surface

### Brain

- `brain/` is the canonical top-level Brain surface with full implementation

### Domains

- `domains/` is the canonical top-level bounded-context surface
- `apps/web/modules/` contains the frontend domain-owned UI modules

### Platform

- `platform/` is the canonical top-level technical kernel surface
- `interfaces/` is the canonical surface for transport, middleware, storage, config, and websocket entrypoints

### Shared packages

- `packages/` is the current shared package root for contracts, schemas, permissions, and primitives

## Bounded Contexts

The current bounded contexts are:

- identity
- demand
- portfolio
- governance
- intelligence
- knowledge
- compliance
- integration
- operations
- notifications
- platform
- ea
- brain

The architecture intent is domain ownership with modular-monolith deployment.

## Runtime Model

The current runtime model is a modular monolith with governed AI control flow.

This means:

- one main application runtime,
- one policy and decision backbone,
- explicit bounded-context separation,
- future service extraction only where operationally justified.

## What Makes COREVIA Different

The distinctive architectural element is not simply modularity.

It is the existence of a Brain-centered control system:

- classification before reasoning,
- policy before model execution,
- validation and HITL before side effects,
- append-only decision evidence,
- approved-only learning.

That is the reason the repository should visibly surface the Brain as a first-class architectural boundary.

## Primary References

- [../ARCHITECTURE.md](../ARCHITECTURE.md)
- [REPOSITORY_STRUCTURE_TRANSITION.md](REPOSITORY_STRUCTURE_TRANSITION.md)
- [decision-spine.md](decision-spine.md)
- [domain-model.md](domain-model.md)
- [deployment.md](deployment.md)