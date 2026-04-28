# ADR-0002: Drizzle ORM Over Prisma and TypeORM

> **Status:** accepted
>
> **Date:** 2025-01-20
>
> **Deciders:** Platform Architecture Team

## Context

We needed an ORM / query builder for PostgreSQL with TypeScript type safety, pgvector support, and a schema-first approach that integrates well with Zod validation.

## Decision

We chose **Drizzle ORM** for:

- Schema-as-code with full TypeScript inference (no code generation step)
- Native pgvector support for RAG/embedding workloads
- Drizzle-Zod integration for automatic Zod schema derivation from table definitions
- Lightweight runtime (~10KB) compared to Prisma (~8MB engine)
- SQL-like query builder that maps closely to actual SQL (no hidden magic)
- Migration generation via `drizzle-kit`

## Consequences

### Positive

- 153 table definitions with full type inference, no codegen step needed
- Shared contracts (`drizzle-zod`) eliminate shape drift between DB ↔ API ↔ client
- pgvector queries work natively for knowledge base embeddings
- Schema changes are instant — no `prisma generate` or `typeorm sync` step

### Negative

- Smaller ecosystem than Prisma (fewer community plugins, guides)
- Manual join management — no automatic relation loading like Prisma `include`
- Migration tooling is less mature than Prisma Migrate

## Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
|-------------|------|------|----------------|
| Prisma | Excellent DX, large ecosystem, automatic relations | Heavy runtime (8MB engine), codegen required, pgvector workarounds | Runtime weight, codegen step, pgvector |
| TypeORM | Mature, decorator-based entities | Poor TypeScript inference, inconsistent API, maintenance concerns | Type safety gaps |
| Kysely | Lightweight, SQL-first | No schema-as-code, no Zod integration, no migration tooling | Missing schema-first features |
