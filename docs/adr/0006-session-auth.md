# ADR-0006: Session-Based Authentication Over JWT

> **Status:** accepted
>
> **Date:** 2025-01-25
>
> **Deciders:** Platform Architecture Team

## Context

The platform requires authentication for a government-grade enterprise application. Key requirements: immediate session revocation, activity-based timeout, CSRF protection, and no client-side token storage vulnerabilities.

## Decision

We chose **server-side session authentication** (`express-session` + `connect-pg-simple`):

- Sessions stored in PostgreSQL (primary) with optional Redis (`connect-redis`) for performance
- HttpOnly, Secure, SameSite=Strict cookies — immune to XSS token theft
- CSRF token validation on all state-changing requests
- Configurable session timeout and inactivity enforcement
- Immediate revocation: delete the session row → user is logged out instantly

## Consequences

### Positive

- No tokens stored in localStorage/sessionStorage (XSS-safe)
- Immediate session revocation — critical for government security requirements
- Cookie-based auth works natively with SSR and traditional form submissions
- Session data (user, permissions) available server-side without per-request DB lookups (cached in session store)

### Negative

- Server must maintain session state (stateful) — requires sticky sessions or shared session store for horizontal scaling
- PostgreSQL session store adds load; Redis fallback recommended for production at scale
- More complex CORS configuration (credentials: true, specific origins)

## Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
|-------------|------|------|----------------|
| JWT (access + refresh) | Stateless, easy horizontal scaling | Cannot immediately revoke, XSS vulnerability if stored in localStorage, complex refresh token rotation | Revocation requirement |
| JWT in HttpOnly cookie | Better than localStorage | Still cannot revoke without blocklist (which makes it stateful anyway) | Revocation + complexity |
| OAuth 2.0 / OIDC | Standard, delegated auth | Over-engineered for a single-app deployment, requires external IdP | Simplicity |
