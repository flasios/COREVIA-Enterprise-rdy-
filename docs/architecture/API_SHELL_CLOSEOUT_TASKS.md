# COREVIA API Shell Closeout Tasks

Date: 2026-03-11
Status: Phase 1 closeout plan active; Phase 2 runtime expansion deferred until Phase 1 is complete
Owner: EA / platform architecture track

## What Is Done

The core migration objective is complete:

- `apps/api` is now the visible canonical API shell.
- runtime startup flows through `apps/api/bootstrap`.
- route composition flows through `apps/api/routes`.
- middleware and config surfaces are available under `apps/api`.
- platform health contracts, controllers, and routes are now owned under `apps/api`.
- `apps/api/index.ts` is the canonical entry point.

This means the primary migration is complete. The remaining work should be handled in two explicit phases so operational growth does not outrun architectural discipline.

This document is the Phase 1 architecture-closeout backlog inside the broader enterprise launch program documented in [ENTERPRISE_LAUNCH_PLAN.md](ENTERPRISE_LAUNCH_PLAN.md).

## Phase Model

### Phase 1: Complete The Current System Properly

Goal:

- finish the current monolith/API-shell architecture so it is documented, validated, and operationally trustworthy.

Scope:

- OpenAPI completion
- remaining `apps/api` transport ownership work
- seam tests and boundary hardening
- dependency debt cleanup

Exit criteria:

- the monolith/API-shell structure is complete enough to freeze
- docs and generated artifacts are current
- key seams are tested
- known dependency debt for this track is remediated or consciously accepted

### Phase 2: Promote New Runtime Components Only When Real

Goal:

- add new Docker/Kubernetes runtime units only when they correspond to real independent processes.

Candidate runtime additions:

- `worker`
- `ai-gateway`
- `web`

Entry rule:

- do not begin Phase 2 until Phase 1 is complete and the runtime split is justified by real operating needs.

## Phase 1 Backlog

### 1. Documentation And API Contract Completion

- [ ] Inspect remaining demand route coverage gaps in `interfaces/config/swagger.ts`.
- [ ] Extend remaining demand endpoint documentation in `interfaces/config/swagger.ts`.
- [ ] Regenerate `docs/openapi.json` via `npm run docs:api`.
- [ ] Validate the generated artifact and ensure no diagnostics remain in OpenAPI-related files.

Definition of done:

- demand route coverage is materially complete for the active transport surface.
- `docs/openapi.json` is regenerated from current sources.
- diagnostics and generation errors are clean.

### 2. Platform Transport Ownership Completion

- [ ] Move identity transport contracts into `apps/api/contracts`.
- [ ] Introduce identity controllers under `apps/api/controllers`.
- [x] Replace direct platform route dependency on `domains/identity/api` with `apps/api` route ownership.
- [x] Review whether any remaining platform transport endpoints still bypass `apps/api`.

Definition of done:

- platform-facing HTTP transport is owned from `apps/api` surfaces.
- `domains/*` are implementation dependencies, not transport owners.

### 3. Boundary Hardening

- [ ] Add seam-level tests around `apps/api/bootstrap`, `apps/api/routes`, and `apps/api/routes/health.ts`.
- [ ] Add regression checks for route registration and health endpoints.
- [x] Audit `apps/api` imports for remaining unnecessary reach-through into deep paths.

Definition of done:

- the new `apps/api` shell has tests around the key assembly seams.
- import boundaries are intentional and documented.

### 4. Dependency Debt

- [ ] Resolve the existing npm dependency issue reported for `inflight@1.0.6` from the root dependency graph.
- [ ] Re-run dependency scanning after remediation.

Definition of done:

- no known medium-or-higher dependency issue remains from the current package graph for this track.

## Phase 1 Execution Order

1. Finish remaining demand OpenAPI documentation.
2. Regenerate and validate `docs/openapi.json`.
3. Complete identity transport ownership under `apps/api`.
4. Add seam tests for the new API shell.
5. Clean dependency debt.

## Phase 1 Expected Remaining Effort

- Documentation closeout: 0.5 to 1 day
- Identity transport ownership: 0.5 to 1 day
- Seam tests and hardening: 0.5 to 1 day
- Dependency cleanup: variable, likely less than 0.5 day if transitive remediation is straightforward

## Phase 2 Backlog

Only start these after Phase 1 is signed off.

### 1. Worker Runtime Separation

- [ ] Decide whether queue processing should run as a dedicated process instead of being initialized inside the API runtime.
- [ ] If yes, create a real worker entrypoint under `apps/api` or `platform` runtime ownership.
- [ ] Add a real `worker` service to `infrastructure/docker/docker-compose.yml`.
- [ ] Add worker deployment guidance to Kubernetes and operational docs.

Definition of done:

- queue/background execution is a real isolated runtime, not a placeholder.

### 2. AI Runtime Separation

- [ ] Decide whether COREVIA will run a first-class internal AI container or continue relying on configured external/local providers.
- [ ] If yes, define the runtime boundary and create a real `ai-gateway` image and compose service.
- [ ] Add service health, configuration, and deployment guidance.

Definition of done:

- `ai-gateway` exists only if it is a real operating component with its own health, config, and deployment rules.

### 3. Web Runtime Separation

- [ ] Decide whether the frontend should remain bundled in the API-centric deployment model or become an independently deployed runtime.
- [ ] If yes, create a real `web` image and deployment path.
- [ ] Update ingress, environment, and CI/CD docs accordingly.

Definition of done:

- `web` becomes a real independently deployable runtime, not a speculative Dockerfile.

## Phase 2 Entry Gate

Do not begin runtime-splitting work until:

- `apps/api` ownership closeout is complete,
- OpenAPI/docs are current,
- seam tests exist for the current shell,
- dependency/security baseline is acceptable.

## Re-entry Commands

Use these when resuming this track:

```bash
npm run build:server
npm run docs:api
```

Validation references:

- `apps/api/bootstrap`
- `apps/api/routes`
- `apps/api/contracts`
- `apps/api/controllers`
- `interfaces/config/swagger.ts`
- `docs/openapi.json`