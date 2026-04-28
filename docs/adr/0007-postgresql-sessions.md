# ADR-0007: PostgreSQL for Session Storage Over Redis-Only

> **Status:** accepted
>
> **Date:** 2025-01-28
>
> **Deciders:** Platform Architecture Team

## Context

Session storage needs to be persistent, resilient, and support immediate revocation. We already use PostgreSQL as the primary database and Redis as an optional cache layer.

## Decision

**PostgreSQL** as the primary session store (`connect-pg-simple`), with **Redis as optional fallback** (`connect-redis`, gated behind `ENABLE_REDIS=true`).

- Sessions survive Redis restarts (PostgreSQL is the source of truth)
- No additional infrastructure required for basic deployments
- Redis can be enabled for high-traffic production deployments where session lookup latency matters
- `assertProductionSecurityConfig()` validates session configuration at startup

## Consequences

### Positive

- Zero additional infrastructure for development and small deployments
- Sessions survive infrastructure restarts (durable in PostgreSQL)
- No Redis dependency for the application to function
- Session data can be queried with SQL for admin/audit purposes

### Negative

- PostgreSQL session lookups are ~1-3ms slower than Redis (~0.1ms)
- At extreme scale (10K+ concurrent sessions), PostgreSQL session table could become a bottleneck
- Requires periodic cleanup of expired sessions (handled by `connect-pg-simple` built-in pruning)

### Neutral

- Redis session store is pre-configured and toggleable — no code changes needed to switch
