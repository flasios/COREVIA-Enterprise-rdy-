# COREVIA Interface File Move Matrix

Date: 2026-03-10

## Purpose

This matrix turns the interface-layer map into a concrete current-to-target move view for the server transport layer.

## Move Matrix

| Current path | Current role | Target meaning | Recommended target | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| `server/routes/index.ts` | legacy registerRoutes entrypoint and server assembly bridge | interface composition adapter | `interfaces/http/registerRoutes.ts` | high | Keep thin. It already composes routes, error handling, HTTP server creation, and websocket setup. |
| `server/app/routes/registerPlatformRoutes.ts` | platform route registration | interface HTTP composition | `interfaces/http/registerPlatformRoutes.ts` | high | Good candidate for the canonical platform-route composition entrypoint. |
| `server/app/routes/registerDomainRoutes.ts` | domain route registration | interface HTTP composition | `interfaces/http/registerDomainRoutes.ts` | high | Good candidate for canonical domain-route composition. |
| `server/app/bootstrap/index.ts` | startup/bootstrap orchestration | app bootstrap, not domain logic | `apps/api/bootstrap/index.ts` or `server/app/bootstrap/index.ts` retained | medium | Keep separate from transport concerns. This is bootstrap, not middleware. |
| `server/app/bootstrap/eventBus.ts` | runtime event-bus bootstrap | bootstrap/platform composition | `apps/api/bootstrap/eventBus.ts` or `platform/events/bootstrap.ts` | low | Depends on whether event bootstrap remains runtime-local or becomes a platform bootstrap concern. |
| `server/middleware/auth.ts` | auth middleware | interface middleware | `interfaces/middleware/auth.ts` | high | Transport security concern. |
| `server/middleware/csrf.ts` | CSRF protection | interface middleware | `interfaces/middleware/csrf.ts` | high | Transport security concern. |
| `server/middleware/rateLimiter.ts` | route-level throttling | interface middleware | `interfaces/middleware/rateLimiter.ts` | high | Remains transport-facing even if it uses platform-backed stores. |
| `server/middleware/security.ts` | transport security headers | interface middleware | `interfaces/middleware/security.ts` | high | HTTP-layer concern. |
| `server/middleware/sessionSecurity.ts` | session transport hardening | interface middleware | `interfaces/middleware/sessionSecurity.ts` | high | Keep session policy close to transport layer. |
| `server/middleware/tenantScope.ts` | request tenant scoping | interface middleware | `interfaces/middleware/tenantScope.ts` | high | HTTP request scoping concern. |
| `server/middleware/correlationId.ts` | request correlation identity | interface middleware | `interfaces/middleware/correlationId.ts` | medium | Cross-cutting, but still request/transport-oriented. |
| `server/middleware/timeout.ts` | request timeout behavior | interface middleware | `interfaces/middleware/timeout.ts` | medium | Transport behavior concern. |
| `server/middleware/validateBody.ts` | request validation helper | interface middleware | `interfaces/middleware/validateBody.ts` | medium | HTTP request validation concern. |
| `server/middleware/responseValidation.ts` | response validation helper | interface middleware | `interfaces/middleware/responseValidation.ts` | medium | Response-shaping concern. |
| `server/websocket.ts` | websocket auth, presence, realtime collaboration | websocket interface boundary | `interfaces/websocket/index.ts` | high | Split later if needed into session auth, presence, and collaboration internals. |
| `server/platform/http/platformServer.ts` | HTTP/HTTPS server factory and TLS handling | platform HTTP runtime primitive | `platform/http/platformServer.ts` | retain | This is correctly platform-scoped and should not move into interfaces. |

## Recommended Sequencing

### Wave 1

- treat `server/routes/index.ts` and `server/app/routes/*` as the canonical interface composition seam,
- keep `server/platform/http/platformServer.ts` explicitly platform-scoped,
- document `server/middleware/*` as interface middleware.

### Wave 2

- introduce alias-friendly paths for interface composition and middleware,
- keep legacy paths working while imports converge.

### Wave 3

- move or mirror websocket entrypoints into a clearer interface root,
- perform physical path normalization only after the import graph is controlled.

## Non-Negotiables

1. do not move platform HTTP primitives into the interface layer,
2. do not let interface files absorb domain workflow logic,
3. keep bootstrap concerns distinct from request middleware,
4. keep `server/routes/index.ts` composition-only while the transition is in progress.