# COREVIA Module Standard

Status: active

This document is the implementation-facing standard for keeping COREVIA aligned with the enterprise architecture baseline.

COREVIA is a modular monolith. The system should read as:

```text
platform -> brain -> domains -> interfaces -> apps
```

This standard does not replace the wider EA package. It turns the existing EA decisions into day-to-day repository rules.

## 1. Canonical Roots

The canonical source roots are:

```text
apps/            runtime entrypoints and user-facing applications
brain/           Decision Spine and governed reasoning engine
domains/         bounded contexts and business capabilities
platform/        cross-cutting technical kernel, no domain policy
interfaces/      HTTP, websocket, middleware, route composition, storage ports
packages/        shared contracts, schemas, permissions, primitives, constants
infrastructure/  scripts, migrations, deployment, containers, IaC
docs/            architecture, operations, runbooks, evidence
```

New source code must be placed by ownership, not convenience.

## 2. Backend Domain Shape

Every backend bounded context under `domains/{context}` uses this shape:

```text
domains/{context}/
  api/              HTTP routes, validation, request/response mapping
  application/      use cases, orchestration, transaction boundaries
  domain/           business rules, policies, value objects, domain events, ports
  infrastructure/   repositories, external adapters, persistence mapping
  index.ts          public bounded-context surface
```

Layering direction is:

```text
api -> application -> domain -> infrastructure
```

Rules:

- `api/` may call `application/`; it must not contain business policy.
- `application/` coordinates use cases and may call domain services and infrastructure ports.
- `domain/` must not import HTTP, DB, filesystem, queue, cache, or framework code.
- `infrastructure/` implements ports and technical adapters for the domain.
- Cross-domain access goes through contracts, ports, or explicit public surfaces.
- Do not deep-import arbitrary files from another bounded context.

## 3. Frontend Module Shape

Frontend bounded-context UI lives under `apps/web/modules/{domain}`.

Preferred shape:

```text
apps/web/modules/{domain}/
  api/              thin frontend API clients and query helpers
  components/       reusable domain UI components
  hooks/            domain-specific React hooks
  pages/            route-level screens owned by the domain
  state/            query keys and domain-local client state
  types/            UI-facing domain types
  utils/            pure presentation helpers
  index.ts          public UI module surface
```

Rules:

- Pages are thin composition shells.
- Heavy workflow behavior belongs inside module-owned components, hooks, or services.
- Shared UI primitives belong in `apps/web/components` or `apps/web/shared` only when truly cross-domain.
- Domain-specific business presentation logic should not move into generic shared folders.
- A module should import another module through its public surface unless there is a documented exception.

## 4. EA And Registry UI

Enterprise Architecture ownership covers:

- architecture assessment and target-state views,
- capability registry,
- application registry,
- data-domain registry,
- technology standards,
- integration architecture views.

`apps/web/modules/ea` and `apps/web/modules/ea-registry` may remain separate UI modules if their responsibilities stay explicit:

- `ea`: architecture assessment/reporting experience.
- `ea-registry`: registry CRUD and standards-governance experience.

If the split becomes confusing, prefer moving registry code under `apps/web/modules/ea/registry` in a controlled migration.

## 5. Generated Files

Generated artifacts should not live inside source module trees unless a tool requires it and the exception is documented.

Preferred locations:

```text
dist/                 production build output
coverage/             test coverage output
infrastructure/tmp/   temporary/generated operational artifacts
```

Source-tree `dist/` folders are transition debt. Do not add new ones.

## 6. Enforcement

`npm run quality:architecture-boundary` enforces the hard parts of this standard.

The first enforcement level is:

- canonical roots exist,
- backend domains have required layers,
- backend domains expose `index.ts`,
- frontend modules expose `index.ts` unless explicitly transitional,
- source-tree `dist/` folders are blocked,
- frontend cross-module imports use public module surfaces,
- backend cross-domain infrastructure imports are blocked,
- backend API routes cannot import infrastructure directly,
- backend domain layers cannot import runtime/framework dependencies,
- source files stay within the EA decomposition budget unless they are listed in the temporary baseline.

The source file budget is currently `1500` lines and is enforced by `.architecture-size-baseline.json`.
Files already above the budget are transition debt: they may shrink, but they may not grow beyond their baseline line count.
New oversized files fail the architecture gate.

Future levels should add:

- stricter per-layer budgets,
- large-screen composition budgets,
- public-surface completeness checks.
