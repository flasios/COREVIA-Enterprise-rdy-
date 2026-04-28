# COREVIA Interface Layer Map

Date: 2026-03-10

## Purpose

This document inventories the current transport and composition layer so it can be converged toward a clearer `interfaces/` architecture without destabilizing the running system.

## Architectural Intent

The target repository model should make these concerns obvious:

- `interfaces/http/`
- `interfaces/middleware/`
- `interfaces/websocket/`
- route composition as an interface concern, not domain logic

The current repository is already close to this. The main need is clearer naming and consolidation.

## Current Interface-Related Roots

### 1. Legacy route adapter

Current file:

- `server/routes/index.ts`

Current role:

- provides the main `registerRoutes(app)` entrypoint used by backend startup,
- applies per-route rate limiters,
- calls `registerPlatformRoutes` and `registerDomainRoutes`,
- attaches the centralized error handler,
- creates the HTTP server,
- attaches websocket support.

Architectural interpretation:

- this file is effectively an interface composition adapter,
- it already behaves like a thin bootstrap-to-interface bridge,
- it should not accumulate domain behavior.

### 2. Application composition root

Current files:

- `server/app/routes/registerPlatformRoutes.ts`
- `server/app/routes/registerDomainRoutes.ts`
- `server/app/bootstrap/index.ts`
- `server/app/bootstrap/eventBus.ts`

Current role:

- compose route registration,
- mount platform and domain route groups,
- initialize runtime/bootstrap concerns.

Architectural interpretation:

- these files are closer to the intended interface composition layer than much of the older path structure,
- `server/app/routes/*` can evolve into the canonical route composition boundary.

### 3. HTTP-only middleware

Current root:

- `server/middleware/`

Observed files include:

- `auth.ts`
- `csrf.ts`
- `rateLimiter.ts`
- `security.ts`
- `sessionSecurity.ts`
- `tenantScope.ts`
- `correlationId.ts`
- `timeout.ts`
- request/response validation helpers.

Architectural interpretation:

- this is already an `interfaces/middleware` layer in practice,
- the main improvement needed is semantic grouping and eventual path normalization.

### 4. Websocket interface

Current file:

- `server/websocket.ts`

Current role:

- authenticates websocket upgrades from session state,
- owns realtime collaboration and presence wiring,
- handles message transport concerns.

Architectural interpretation:

- this is a clear `interfaces/websocket` candidate,
- it should remain focused on channel/session/realtime concerns rather than absorb domain rules.

### 5. Platform HTTP server

Current file family:

- `server/platform/http/*`

Current role:

- create platform-aware HTTP server primitives,
- support shared transport/runtime behavior.

Architectural interpretation:

- this belongs to `platform`, not `interfaces`,
- `interfaces` should depend on it, not replace it.

## Current Flow

The current effective flow is:

```text
server/index.ts
  -> server/routes/index.ts
     -> server/app/routes/registerPlatformRoutes.ts
     -> server/app/routes/registerDomainRoutes.ts
     -> server/platform/http/platformServer.ts
     -> server/websocket.ts
```

That means the repo already has a usable layering story. It is just not yet expressed as one obvious `interfaces/` boundary.

## Proposed Interface Convergence Model

See also:

- [interface-file-move-matrix.md](interface-file-move-matrix.md)

Target meaning:

```text
interfaces/
  http/
    registerRoutes.ts
    registerPlatformRoutes.ts
    registerDomainRoutes.ts
  middleware/
    auth.ts
    csrf.ts
    rateLimiter.ts
    tenantScope.ts
    security.ts
  websocket/
    index.ts
    presence.ts
    collaboration.ts
```

This does not require a big-bang move.

## Safe Transition Steps

### Step 1

Treat `server/routes/index.ts` as the legacy interface adapter and keep it thin.

### Step 2

Treat `server/app/routes/*` as the canonical route composition boundary.

### Step 3

Document `server/middleware/*` as the transport middleware boundary and avoid mixing in non-HTTP platform concerns.

### Step 4

Plan a future move of `server/websocket.ts` into an interface-oriented websocket root.

### Step 5

Only after those semantic boundaries are stable, consider path convergence toward a true `interfaces/` top-level boundary.

## Rules To Preserve

1. interface files do not own domain policy,
2. middleware remains transport/security scoped,
3. business use cases remain in bounded contexts,
4. platform HTTP server utilities remain in `platform`,
5. websocket code stays channel-oriented, not domain-oriented.

## Immediate Repo Action Candidates

1. keep `server/routes/index.ts` small and composition-only,
2. reduce direct route registration complexity by consolidating interface-facing composition,
3. split websocket internals if the file keeps growing,
4. use this map as the basis for any future path move.