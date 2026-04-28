# ADR-0008: Zod Shared Contracts Between Client and Server

> **Status:** accepted
>
> **Date:** 2025-02-05
>
> **Deciders:** Platform Architecture Team

## Context

With a full-stack TypeScript application, we needed a mechanism to ensure API request/response shapes are consistent between the Express server and the React client. Type-only sharing (interfaces) doesn't provide runtime validation.

## Decision

We use **Zod schemas in `shared/contracts/`** as the single source of truth:

- Shared Zod schemas define the shape of API payloads
- Server uses these for request body validation (`validateBody` middleware)
- Client uses the inferred TypeScript types for type-safe API calls
- `drizzle-zod` generates Zod schemas from database table definitions
- 8 domain contract packages in `shared/contracts/`

## Consequences

### Positive

- Runtime validation AND compile-time type safety from the same source
- Shape drift is impossible — if the schema changes, both server and client must adapt
- Validation error messages are consistent and structured (Zod error format)
- Shared contracts serve as living API documentation

### Negative

- Zod schemas can become verbose for complex nested objects
- Circular dependency risk if server/client import patterns aren't disciplined
- Zod bundle size adds to client bundle (~13KB gzipped)

### Neutral

- `drizzle-zod` auto-generates schemas from DB tables, reducing manual schema maintenance
