# COREVIA Source Structure — Current State

This document defines the repo structure for the COREVIA system and the rules that keep it stable as the platform grows.

> **Status (March 2026):** Backend module boundaries are enforced and currently clean under the active architecture checks. The canonical top-level roots `apps/api`, `brain`, `domains`, `platform`, `interfaces`, `packages`, and `infrastructure` are the sole filesystem layout — the legacy `server/` tree has been fully deleted.

## Goals
- Make boundaries explicit (by domain, not by technical folder type).
- Keep business rules out of HTTP handlers.
- Make refactors safe: changes stay inside one module.
- Make compliance/audit easier: privileged actions have a consistent entrypoint + logging pattern.

## Non‑Negotiables (Rules)
**Layering direction (backend):** `api -> application -> domain -> infrastructure`.

- `api/` (HTTP) must not contain business rules.
- `domain/` must not import DB, HTTP, queues, or filesystem.
- `infrastructure/` must not be imported by `api/` directly (only through `application/`).
- Cross‑module imports must go through contracts or explicit ports (no random deep imports).
- ESLint `no-restricted-imports` rules enforce all of the above.

## Repository Structure

```text
COREVIA/
  apps/
    web/
    src/
      app/                          # App bootstrap (router, providers)
      modules/                      # UI bounded contexts (domain-first)
        demand/                     # Demand management UI
          api/                      # Demand API client calls (thin)
          components/
          hooks/
          routes/
          state/
          types/
          index.ts
        portfolio/                  # Portfolio management UI
        knowledge/                  # Knowledge management UI
        workspace/                  # Intelligent Workspace / mission-control UI
        compliance/                 # Compliance & audit UI
        intelligence/               # AI intelligence UI
        integration/                # Integrations UI
        admin/                      # Admin / operations UI
      shared/
        components/                 # Design-system components only
        hooks/                      # Cross-module hooks only
        lib/                        # Utilities (no domain logic)
        services/                   # Shared adapters (http client, websocket client)
        types/
      pages/                        # Thin composition only (lazy re-exports)

  apps/
    api/                            # Canonical backend application entrypoint surface

  brain/                            # COREVIA Brain (canonical top-level surface)
    pipeline/                       # Orchestrator + layer definitions
    layers/                         # Layer 1-8 implementations
    storage/                        # Brain-specific storage
    services/                       # Brain services (demand sync, etc.)
    spine/                          # Decision spine orchestrator

  domains/                          # 11 backend bounded contexts
      identity/                     # Authentication, users, sessions, permissions
        api/
        application/
        domain/
        infrastructure/
      demand/                       # Demand reports, analysis, conversion
        api/
        application/
        domain/
        infrastructure/
      portfolio/                    # Project management, gates, milestones, risks
        api/
        application/
        domain/
        infrastructure/
      knowledge/                    # Knowledge documents, RAG, AI insights
        api/
        application/
        domain/
        infrastructure/
      compliance/                   # Policy packs, evidence, audit
        api/
        application/
        domain/
        infrastructure/
      intelligence/                 # Proactive intelligence, learning patterns
        api/
        application/
        domain/
        infrastructure/
      integration/                  # Webhooks, external system connectors
        api/
        application/
        domain/
        infrastructure/
      operations/                   # Teams, users admin, cache, notifications
        api/
        application/
        domain/
        infrastructure/
      governance/                   # Governance gates, decision workflows
        api/
        application/
        domain/
        infrastructure/
      notifications/                # Notification delivery
        api/
        application/
        domain/
        infrastructure/
      workspace/                    # Intelligent Workspace aggregation and orchestration surface
        api/
        application/
        domain/
        infrastructure/
      platform/                     # Health checks, system diagnostics
        api/
        application/
        infrastructure/

  platform/                         # Cross-cutting technical platform (no domain)
    logging/                        # Logger, structured logging, audit sink
    config/                         # Typed config loader

  interfaces/                       # Transport/composition compatibility surface
    http/                           # Route composition surface
    middleware/                     # HTTP middleware surface
    websocket/                      # Realtime entrypoint surface
    storage/                        # Shared storage layer (ports + repositories)
    config/                         # Interface-adjacent runtime config surface
    types/                          # Interface/runtime typing surface

  packages/                         # Shared between web + server
    contracts/                      # Zod schemas + DTOs used by both sides
    primitives/                     # IDs, date helpers, Result/Either, enums
    constants/
    schemas/                        # DB table definitions (Drizzle schema)
    models/                         # Shared model types
    dtos/                           # Data transfer objects

  infrastructure/
    scripts/
    migrations/
    infra/
    charts/
    uploads/
    docker/

  docs/
```

## Backend Module Template (What goes where)

### `modules/<module>/api/`
- Express router definitions.
- Request validation (Zod) using shared contracts where possible.
- Mapping: HTTP <-> application commands/queries.
- No DB calls, no business rules.

**Allowed imports:** application, shared contracts, platform middleware types.

### `modules/<module>/application/`
- Use-cases and orchestration.
- Transaction boundaries.
- Calls domain services/policies and ports.
- Maps domain errors to application errors.

**Allowed imports:** domain, shared contracts, platform abstractions.

### `modules/<module>/domain/`
- Entities/value objects.
- Policies (e.g., “canApprove”, “isGateReady”).
- Domain events (plain objects).
- Ports (interfaces) that infrastructure implements.

**Allowed imports:** shared primitives/contracts only.

### `modules/<module>/infrastructure/`
- Repositories (Drizzle/Postgres).
- External adapters (email provider, storage, third-party APIs).
- Mapping between DB rows <-> domain models.

**Allowed imports:** domain ports, platform/db, platform/cache/queue.

## Shared Contracts (Client <-> Server)

All request/response DTOs that cross the network live in `packages/contracts/`.

- Zod schemas are the source of truth.
- Client API clients use the same schemas for validation and typing.
- No React imports in contracts; no Express imports in contracts.

## Frontend Best Practices

- `pages/` are thin shells (layout + module composition).
- Domain logic stays in `modules/<domain>/`.
- Data fetching uses a shared HTTP client (in `apps/web/shared/services/`) plus shared frontend utilities in `apps/web/shared/lib/`, plus per-module API wrappers (`modules/<domain>/api/`).
- Query keys are module-local (`modules/<domain>/state/queryKeys.ts`).

## Enforcement (Active)

Currently enforced:
- **ESLint `no-restricted-imports`**: 7 rule blocks preventing API→infrastructure imports across all modules.
- **TypeScript path aliases**: `@brain/`, `@domains/`, `@platform/`, `@interfaces/`, `@api/`, `@shared/`, `@/` for clean imports.
- **Barrel exports**: Each layer exposes only its public surface via `index.ts`.
- No deep imports across modules (only via `index.ts` exports or shared contracts).
- Frontend module files are blocked from importing the legacy project-workspace and business-case financial feature paths directly; they must import through module-owned barrels.

## Migration Status — In Progress

### Phase 1 — Scaffold + Guardrails ✅
- Module folders created for all 11 backend bounded contexts.
- Route composition in `interfaces/routes/` mounts module routers.
- Shared contracts folder with Zod DTOs.
- Boundary lint rules enforced (error mode).

### Phase 2 — Vertical Slices ✅
All 11 modules migrated:
`identity → demand → portfolio → knowledge → compliance → intelligence → integration → operations → governance → notifications → platform`

Additional bounded context now active:
`workspace` for the Intelligent Workspace aggregation surface and mission-control API.

### Phase 3 — Platform Extraction ✅
- Cross-cutting platform services in `platform/` (logging, config).
- Storage port interfaces in `interfaces/storage/ports.ts`.

### Phase 4 — Frontend Module Migration ✅
- 7 frontend domain modules exist: `demand, portfolio, knowledge, compliance, intelligence, integration, admin`.
- Active consumers import through module-owned public surfaces.
- The former `project-workspace` and `business-case` feature trees now live directly under:
  - `apps/web/modules/portfolio/workspace/*`
  - `apps/web/modules/demand/business-case/*`
- The transitional wrapper phase for those two trees is complete.

### Phase 5 — Server Deletion & Cleanup ✅
- Legacy `server/` directory fully deleted (607 files, 2.4 MB).
- All imports, configs, scripts, CI, and Docker references migrated to canonical roots.
- Documentation updated to reflect final canonical structure.

## Definition of Done (Module)
- All HTTP routes in `modules/<module>/api/`.
- No business rules in routers.
- Domain rules testable without DB (unit tests via mock ports).
- Infrastructure implements domain ports.
- Contracts shared and validated.
- ESLint boundary rules enforced for the module's active public surface.
