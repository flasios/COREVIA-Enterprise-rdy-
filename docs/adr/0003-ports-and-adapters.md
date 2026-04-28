# ADR-0003: Ports & Adapters (Hexagonal) Storage Architecture

> **Status:** accepted
>
> **Date:** 2025-01-22
>
> **Deciders:** Platform Architecture Team

## Context

With 12 domain modules and 150+ database tables, we needed a storage access pattern that:

1. Prevents modules from directly coupling to the database implementation
2. Makes the storage backend swappable (PostgreSQL today, potentially cloud-native services later)
3. Provides clear per-module interfaces for testing (mockable ports)

## Decision

We adopted **Ports & Adapters (Hexagonal Architecture)** at the storage layer:

- **11 port interfaces** (e.g., `IDemandStoragePort`, `IPortfolioStoragePort`) — one per bounded context
- **11 repository modules** implementing the methods using Drizzle ORM queries
- **`PostgresStorage`** class as the single adapter that delegates to all repositories
- **`IStorage`** composition root type = intersection of all 11 port interfaces
- **`interfaces/storage.ts`** as the composition root that wires the singleton

## Consequences

### Positive

- Each module can declare its dependency on a narrow port interface (ISP)
- Storage is fully mockable in unit tests — no database needed
- Swapping to a different database (or cloud-native per-service DBs in microservices) requires only implementing a new adapter
- Clear separation: domain logic never sees SQL

### Negative

- `IStorage` is a "God Interface" (~423 methods) — modules currently receive the full union instead of narrow ports
- `PostgresStorage` is a thin delegator class (~482 lines) that could feel boilerplate-heavy
- Adding a new storage method requires touching 3 files: port, repository, `PostgresStorage`

### Neutral

- The `modulePortMap.ts` narrow type aliases were added to enable gradual migration toward ISP-compliant injection
- The God Interface concern is mitigated by architecture boundary checks preventing cross-module storage access
