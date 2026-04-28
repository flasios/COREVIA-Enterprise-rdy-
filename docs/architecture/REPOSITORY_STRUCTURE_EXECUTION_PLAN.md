# COREVIA Repository Structure Execution Plan

Date: 2026-03-10
Status: transition execution plan

## Purpose

This document turns the repository structure target into a concrete implementation sequence.

The objective is to improve architectural legibility without destabilizing delivery.

## Execution Principle

Do not perform a giant rename.

Instead:

1. make architectural intent explicit,
2. strengthen the existing boundaries,
3. move high-value roots first,
4. let physical structure converge in controlled waves.

## Highest-Value Move Candidates

### A. Brain visibility

Current roots:

- `server/core/corevia/`

Target meaning:

- `brain/`

Concrete transition candidates:

1. define a documented public Brain surface around orchestrator, layers, and spine entrypoints,
2. introduce import aliases or barrels that make the Brain readable as a distinct subsystem,
3. move Brain documentation and ownership rules ahead of any broad path migration,
4. only then evaluate selective path relocation from `server/core/corevia` toward a clearer Brain root.

Detailed reference:

- [brain-boundary-plan.md](brain-boundary-plan.md)
- [brain-public-surface-contract.md](brain-public-surface-contract.md)

### B. Interfaces clarity

Current roots:

- `server/app/`
- `server/routes/`
- `server/middleware/`
- `server/websocket.ts`

Target meaning:

- `interfaces/http/`
- `interfaces/middleware/`
- `interfaces/websocket/`
- route composition under one interface-oriented root

Concrete transition candidates:

1. classify every file in `server/app`, `server/routes`, and `server/middleware` as bootstrap, transport, or platform,
2. consolidate route composition and HTTP-only middleware semantics in docs and aliases first,
3. move websocket entrypoints under a clearer realtime/interface boundary,
4. keep business logic out of interface roots.

Detailed reference:

- [interface-layer-map.md](interface-layer-map.md)
- [interface-file-move-matrix.md](interface-file-move-matrix.md)

### C. Domain naming convergence

Current roots:

- `server/modules/`
- `apps/web/modules/`

Target meaning:

- backend `domains/`
- frontend domain-owned `modules/` or `domains/` depending migration appetite

Concrete transition candidates:

1. preserve backend layering exactly,
2. keep frontend decomposition work inside domain-owned module trees,
3. use docs and ADRs to establish `domains` as the canonical architecture term,
4. defer physical backend rename until aliases and import churn controls are ready.

### D. Shared package clarity

Current roots:

- `shared/`

Target meaning:

- `packages/contracts/`
- `packages/primitives/`
- `packages/schemas/`
- `packages/permissions/`

Concrete transition candidates:

1. document `shared/` as a package-like root now,
2. separate shared business contracts from generic utilities more strictly,
3. later split into true package boundaries only if build tooling and ownership benefit from it.

### E. Infrastructure consolidation

Current roots:

- `infrastructure/docker/`
- `infrastructure/scripts/`
- `infrastructure/migrations/`
- `infrastructure/infra/`
- `infrastructure/charts/`

Target meaning:

- `infrastructure/docker/`
- `infrastructure/scripts/`
- `infrastructure/deployment/`
- `infrastructure/migrations/`

Concrete transition candidates:

1. create a documented infrastructure grouping model before moving files,
2. keep docker runtime assets, charts, and infra content under the canonical `infrastructure/` root,
3. replace placeholders with real operational implementations over time,
4. keep working local and CI paths stable during the transition.

## Recommended Wave Plan

### Wave 1: Documentation and naming alignment

Deliverables:

- architecture landing zone under `docs/architecture/`
- current-to-target repository mapping
- architecture language standardized around `platform -> brain -> domains -> interfaces -> apps`

### Wave 2: Boundary hardening without major moves

Deliverables:

- stricter public surfaces for Brain and domains
- clearer interface-vs-platform separation rules
- continued frontend decomposition inside domain-owned trees

### Wave 3: Selective structural moves

Deliverables:

- Brain aliasing or relocation strategy
- interface-root consolidation plan
- infrastructure-root grouping plan

### Wave 4: Full rename candidates, only if justified

Deliverables:

- `client` to `apps/web` if tooling and path churn are worth it
- `shared` to `packages` if package boundaries become operationally valuable
- broader backend top-level rename only after compatibility prep

Detailed reference:

- [FILESYSTEM_TRANSITION_PLAN.md](FILESYSTEM_TRANSITION_PLAN.md)

## Immediate Next Actions

The most defensible next actions in this repository are:

1. continue large-surface frontend decomposition to make domain ownership visible,
2. document the Brain public surface and import expectations,
3. inventory interface files across `server/app`, `server/routes`, `server/middleware`, and `server/websocket.ts`,
4. create a concrete infrastructure grouping map for docker, charts, gateway, infra, scripts, and migrations.

## Success Criteria

This plan is working when:

- new engineers can identify platform, Brain, domains, and interfaces quickly,
- bounded-context ownership is clearer in both client and server code,
- transport code is visibly separate from technical kernel concerns,
- deployment assets read as one operational story,
- large-scale rename work is no longer necessary to explain the architecture.