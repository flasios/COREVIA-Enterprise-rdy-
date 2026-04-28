# ADR-0020: Build Architecture & Migration Completion Plan

> **Status:** superseded by [ADR-0021](0021-server-migration-completion-and-hardening.md)
>
> **Date:** 2026-03-12
>
> **Deciders:** Platform Architecture Team
>
> **Supersedes:** None (extends ADR-0001, ADR-0013, ADR-0017)
>
> **Note (2026-03-13):** The migration plan described below has been **fully executed**. All phases (A–F) are complete, the `server/` directory has been permanently deleted (607 files, 2.4 MB), and all code now lives under canonical roots. ADR-0021 records the completion evidence. The build architecture rules and placement decision tree in this ADR remain authoritative.

## Context

COREVIA is a modular monolith (ADR-0001) with domain-driven bounded contexts (ADR-0013) and runtime profile decomposition (ADR-0017). A migration from the legacy `server/` tree to canonical roots (`domains/`, `platform/`, `interfaces/`, `brain/`) was started in early March 2026 and **completed on 2026-03-12**.

| Canonical Root | Final Ownership |
|---|---|
| `domains/` | 100% — all 11 bounded contexts |
| `platform/` | 100% |
| `interfaces/` | 100% |
| `brain/` | 100% |

The `server/` directory has been permanently deleted. All code now lives under canonical roots with zero symlinks.

Meanwhile, feature development has continued — adding AI services, training containers, and UI capabilities — sometimes placing code in architecturally incorrect locations. This ADR formalizes the build architecture rules and the plan to complete the migration.

## Decision

### 1. Build Architecture Rules

**COREVIA is a single-codebase modular monolith.**

- **One `package.json`** — all TypeScript code shares a single dependency tree.
- **One `npm ci`** — no workspace tools (Nx, Turborepo, pnpm workspaces, Lerna).
- **Four build targets** from the same codebase:
  - `build:client` — Vite bundles `apps/web/` into the frontend SPA.
  - `build:server` — esbuild bundles the API process from `apps/api/` entry.
  - `build:processing-worker` — esbuild bundles the worker process from `apps/worker/` entry.
  - `build:ai-service` — esbuild bundles the AI gateway from `apps/ai-service/` entry.
- **Build targets produce runtime profiles, not separate applications.** All four share the same `domains/`, `platform/`, `brain/`, `packages/` code. They differ only in their entrypoint and which modules they activate.

### 2. Folder Placement Rules

```text
COREVIA/
│
│  ── Application Entrypoints (TypeScript, same monolith build) ──
├── apps/
│   ├── web/                 React frontend (Vite)
│   ├── api/                 Express backend entry
│   ├── worker/              Background processor entry
│   └── ai-service/          AI gateway entry
│
│  ── Architectural Layers (the modular monolith internals) ──
├── brain/                   Intelligence pipeline (layers, reasoning, spine)
├── domains/                 11 bounded contexts (DDD, Clean Architecture)
├── platform/                Cross-cutting technical services (no business logic)
├── interfaces/              Transport & composition (HTTP, WS, middleware)
├── packages/                Shared contracts, schemas, DTOs
│
│  ── Infrastructure & Operations ──
└── infrastructure/
    ├── docker/              All Docker artifacts
    │   ├── docker-compose.yml
    │   ├── api.Dockerfile
    │   ├── worker.Dockerfile
    │   ├── ai-service.Dockerfile
    │   └── engine-c-distillation/   Standalone Python service (own runtime)
    ├── scripts/             Build & operational scripts
    ├── migrations/          Database migrations
    ├── charts/              Helm / K8s charts
    └── infra/               Terraform / IaC
```

**Placement decision tree:**

1. Is it a **TypeScript entrypoint** that boots a runtime profile of the monolith?
   → `apps/<name>/` (source) + `infrastructure/docker/<name>.Dockerfile` (container)

2. Is it **domain business logic** organized by bounded context?
   → `domains/<context>/` with `api/ → application/ → domain/ → infrastructure/` layers

3. Is it **cross-cutting technical plumbing** with no business rules?
   → `platform/<concern>/`

4. Is it **COREVIA intelligence/AI pipeline** logic?
   → `brain/<subsystem>/`

5. Is it a **transport or composition root** (routes, middleware, websocket)?
   → `interfaces/<transport>/`

6. Is it a **shared contract, schema, or DTO** used by both frontend and backend?
   → `packages/<type>/`

7. Is it a **standalone service in a different language/runtime** (Python, Go, etc.)?
   → `infrastructure/docker/<service-name>/` (Dockerfile + source together)

8. Is it a **deployment, build, migration, or infrastructure artifact**?
   → `infrastructure/<type>/`

### 3. Migration Completion Plan

> **All phases below were executed and completed on 2026-03-12. See ADR-0021 for evidence.**

**Phase A — Platform convergence ✅**
Remaining 10 symlinks in `platform/` → replace with real wrapper-owned files.
Impact: 10 files. Low risk — platform is mostly done.

**Phase B — Small domains ✅**
Migrate in order of ascending size to build momentum:
1. `workspace` (5 files)
2. `platform` domain (6 files)
3. `ea` (10 files)
4. `compliance` (11 files)
5. `identity` (15 files)
6. `integration` (15 files)
7. `notifications` (16 files)
8. `operations` (16 files)

Impact: ~94 files across 8 domains. Each is a self-contained migration unit.

**Phase C — Large domains ✅**
Migrate the three largest domains:
1. `governance` (28 files)
2. `intelligence` (48 files)
3. `demand` (64 files)

**Phase D — Heavyweight domains ✅**
The two largest:
1. `knowledge` (75 files)
2. `portfolio` (82 files)

**Phase E — Shared infrastructure ✅**
Migrate the remaining cross-cutting code:
- `server/storage/` (33 files) → `interfaces/storage/` or domain-specific infra
- `server/core/` (44 files) → `brain/` or `domains/intelligence/`
- `server/middleware/` (26 files) → `interfaces/middleware/`
- `server/routes/` (3 files) → `interfaces/http/`
- `server/queues/` (2 files) → `platform/queue/`
- `server/config/` (4 files) → `platform/config/`
- `server/types/` (2 files) → `packages/` or `platform/typing/`
- `server/utils/` (1 file) → appropriate domain or platform module
- `server/validation/` (2 files) → `packages/` or domain-specific
- `server/app/` (5 files) → `apps/api/`

**Phase F — Delete `server/` ✅**
The legacy tree has been permanently deleted (607 files, 2.4 MB).

### 4. Migration Protocol (Per Domain)

For each domain being migrated:
1. Replace symlinks with real files (copy content, update imports).
2. Ensure canonical barrel `domains/<context>/index.ts` exports correctinterface.
3. Update any imports in consuming code to use canonical paths (`@domains/<context>`).
4. Add/verify ESLint `no-restricted-imports` rule blocking legacy paths.
5. Run full test suite to confirm no regressions.
6. Delete the corresponding `server/modules/<context>/` once the domain is fully owned.

### 5. No-Go Rules

- **No new code in `server/`** — all new features go to canonical roots.
- **No new standalone services in `apps/`** — only TypeScript monolith entrypoints belong there.
- **No standalone (non-TS) services outside `infrastructure/docker/`** — Python, Go, etc. services live with their Dockerfiles.
- **No monorepo tooling until migration is complete** — adding workspaces mid-migration creates two transformations at once.

## Consequences

### Positive

- Clear decision tree for where every file belongs — eliminates architectural drift.
- Migration phases are ordered by size — low-risk domains first build confidence.
- Single-codebase build stays simple until team/scale demands otherwise.
- Standalone services (Engine C) are correctly isolated in infrastructure.

### Negative

- Migration is significant effort (~600 files) and must not regress running features.
- No independent scaling of domains until Phase F is complete and microservice extraction is considered.

### Neutral

- Monorepo tooling remains a future option once migration is complete and team size justifies it.
- Docker deployment topology can evolve independently of codebase structure.

## Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
|---|---|---|---|
| Convert to monorepo now | Independent builds, incremental CI | Two transformations at once, 15+ package.jsons to create mid-migration | Migration must finish first |
| Skip migration, use symlinks permanently | Zero effort | Symlinks hide true ownership, edits can mutate wrong tree, fragile on Windows | Defeats the purpose of architectural layering |
| Microservices extraction | Independent deploy/scale | Team of 1-3, shared DB, no operational evidence demanding it | ADR-0001 still holds — no trigger conditions met |
