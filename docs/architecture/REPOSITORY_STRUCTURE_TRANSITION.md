# COREVIA Repository Structure Transition

Date: 2026-03-10
Status: Target-state guidance with transition rules

Related documents:

- [README.md](README.md)
- [system-overview.md](system-overview.md)
- [REPOSITORY_STRUCTURE_EXECUTION_PLAN.md](REPOSITORY_STRUCTURE_EXECUTION_PLAN.md)
- [decision-spine.md](decision-spine.md)
- [domain-model.md](domain-model.md)
- [deployment.md](deployment.md)

## Purpose

This document translates the intended COREVIA enterprise architecture into a repository structure that reads clearly to engineers, reviewers, and operators.

The goal is not a disruptive rename of the whole codebase. The goal is to make the architecture legible in this order:

`platform -> brain -> domains -> interfaces -> apps`

## Target Reading Model

The repository should communicate the system in seconds:

```text
COREVIA
  apps/           # user-facing applications
  brain/          # Decision Spine and governed reasoning engine
  domains/        # bounded contexts / business capabilities
  platform/       # technical kernel
  interfaces/     # transport entry points
  packages/       # shared contracts and primitives
  infrastructure/ # deployment, scripts, migrations
  docs/architecture/
```

## Canonical Structure Names

The canonical target names for the repository are:

- `apps/web`
- `apps/api`
- `brain`
- `domains`
- `platform`
- `interfaces`
- `packages`
- `infrastructure`

When transition documents refer to the target structure, these exact names should be used.

This is the intended conceptual model, and as of 2026-03-10 the canonical top-level roots are now surfaced directly in the filesystem. The remaining transition work is primarily internal import cleanup and retirement of legacy compatibility paths.

## Current-to-Target Mapping

The current codebase is already close to this structure. The main need is clearer expression.

| Current | Target meaning | Transition guidance |
| --- | --- | --- |
| `apps/web/` | `apps/web/` | The React SPA root now lives here directly; domain-owned UI now sits under `apps/web/modules`, `apps/web/app`, `apps/web/shared`, and `apps/web/i18n`. |
| `apps/api/` | `apps/api/` | Canonical API runtime entrypoint now exists as the top-level backend application surface. |
| `server/app/` | `interfaces/` plus app bootstrap | The canonical `interfaces/` root is now surfaced; the remaining work is to retire the legacy `server/app` implementation path behind it. |
| `server/core/corevia/` | `brain/` | The top-level `brain/` root now exists as the canonical Brain surface while legacy server paths remain compatible. |
| `server/modules/` | `domains/` | The top-level `domains/` root now exists as the bounded-context surface while imports are still being converged. |
| `server/platform/` | `platform/` | The top-level `platform/` root now exists as the canonical technical kernel surface. |
| `packages/` | `packages/` | Shared contracts, schemas, primitives, and permissions now live here as a first-class package root. |
| legacy operational roots and files (`scripts/`, `migrations/`, Docker files, `infra/`, `gateway/`, `charts/`) | `infrastructure/` | The operational surface now lives physically under `infrastructure/`; remaining work is to replace placeholders with full canonical implementations and update residual documentation. |

## Near-Term Physical Target

Without breaking the current runtime, the repo is converging toward this shape. The canonical operational root is now physical rather than symlink-backed:

```text
COREVIA/
  apps/
    web/
    api/
  brain/
    pipeline/
    layers/
    reasoning/
    orchestration/
    plugins/
    agents/
    control-plane/
  domains/
    demand/
    portfolio/
    knowledge/
    compliance/
    governance/
    intelligence/
    identity/
    operations/
    ea/
    notifications/
  platform/
    ai/
    cache/
    crypto/
    db/
    events/
    logging/
    observability/
    queue/
    security/
    telemetry/
    storage/
  interfaces/
    http/
    websocket/
    middleware/
    routes/
  packages/
    contracts/
    schemas/
    primitives/
    financial/
    permissions/
  infrastructure/
    docker/
    scripts/
    deployment/
    migrations/
  docs/
    architecture/
```

## What Should Change First

### 1. Make the Brain explicit

Priority: high

`server/core/corevia` is the architectural differentiator of the whole platform. It should become visually obvious in the repository.

Recommended direction:

- preserve runtime behavior,
- preserve internal pipeline/layer/spine logic,
- move toward a top-level `brain/` semantic boundary,
- keep the Decision Spine and governed reasoning pipeline together.

This is a naming and visibility improvement more than a functional rewrite.

### 2. Treat backend modules as domains

Priority: high

The current backend folders already behave like DDD bounded contexts. The important architectural rule is:

- keep `api -> application -> domain -> infrastructure`,
- keep contracts and ports as the cross-boundary mechanism,
- prefer renaming `modules` to `domains` only when the repo can absorb the path migration cleanly.

Do not destabilize the system just to force terminology immediately.

### 3. Separate interfaces from the technical kernel

Priority: medium

The current backend bootstrap and route composition are disciplined, but the transport layer should become easier to read.

Target intent:

- `interfaces/http` for route entrypoints,
- `interfaces/middleware` for HTTP-only concerns,
- `interfaces/websocket` for realtime channels,
- `platform/*` for reusable infrastructure capabilities.

This separation makes the system look transport-agnostic and makes future adapters easier.

### 4. Keep frontend UI domain-owned

Priority: high

The frontend now exposes the intended shape directly with `apps/web/modules/*` and thin pages.

The correct rule is:

- each domain owns its pages, components, hooks, services, and state,
- `packages/` stays truly cross-domain,
- large tabs and screens continue to be decomposed into module-local helpers rather than global dumping grounds.

This means the existing frontend direction should be strengthened, not reset.

### 5. Create an architecture doc root

Priority: high

The repo already has strong architecture content under `docs/`, but the architecture set should also be discoverable via a dedicated subfolder.

Recommended initial contents:

- `docs/architecture/REPOSITORY_STRUCTURE_TRANSITION.md`
- `docs/architecture/system-overview.md`
- `docs/architecture/decision-spine.md`
- `docs/architecture/domain-model.md`
- `docs/architecture/deployment.md`

This document is the first step in that folder.

## What Should Not Change

The following existing choices are correct and should be preserved conceptually:

- backend layering inside each bounded context,
- repository plus ports/adapters patterns,
- platform kernel separation for logging, security, observability, storage, and cross-cutting runtime concerns,
- modular-monolith-first evolution strategy,
- governance-first AI control flow centered on the Brain and Decision Spine.

## Transition Rules

To keep the migration disciplined, apply these rules:

1. Do not perform a large-scale tree rename without import-boundary tooling and path migration support.
2. Prefer semantic documentation and boundary enforcement first, then physical moves.
3. Move the highest-significance architectural concepts first: Brain, interfaces, and domain naming.
4. Keep runtime boot stability ahead of structural aesthetics.
5. Preserve modular-monolith deployment while making later extraction possible.

## Recommended Sequence

### Phase 1: Make the architecture legible

- create `docs/architecture/`
- document current-to-target mapping
- align architecture language across docs to `platform -> brain -> domains -> interfaces -> apps`

### Phase 2: Strengthen current boundaries

- continue frontend module decomposition
- continue backend boundary enforcement
- reduce cross-context leakage

### Phase 3: Perform selective physical moves

- extract or alias the Brain into a clearer top-level boundary
- group transport concerns under clearer interface-oriented paths
- consolidate infrastructure assets where it reduces confusion

### Phase 4: Consider repo-level rename convergence

- `client` to `apps/web`
- `server` to `apps/api` plus `interfaces`, `domains`, `brain`, and `platform`
- `shared` to `packages`

This phase should only happen when path churn is justified and automated.

## Summary

The correct direction is not a radical redesign. It is a clearer expression of the architecture COREVIA already has:

- one platform,
- one Brain / Decision Spine,
- multiple bounded contexts,
- explicit interfaces,
- domain-owned applications.

That is the right enterprise structure for a governance-first, sovereign-ready decision platform.