# ADR-0004: TanStack Query Over Redux/Zustand for State Management

> **Status:** accepted
>
> **Date:** 2025-02-01
>
> **Deciders:** Platform Architecture Team

## Context

The COREVIA frontend is server-state-heavy — nearly all UI state derives from API responses (demands, projects, versions, EA data). Very little "client-only" state exists beyond auth context and UI preferences.

## Decision

We chose **TanStack React Query** as the primary state management solution:

- All API data flows through `useQuery` / `useMutation` hooks
- Automatic background refetching, stale-while-revalidate, error retries
- Query invalidation via `queryClient.invalidateQueries()` for optimistic updates
- No global store (Redux, Zustand, MobX) — React Context only for auth and routing state
- Shared query key conventions per module (`["demands"]`, `["projects", projectId]`)

## Consequences

### Positive

- Zero boilerplate for API integration — no actions, reducers, selectors, thunks
- Server state is automatically cached, deduplicated, and garbage collected
- Background refetching keeps UIs fresh without manual polling logic
- DevTools integration (`@tanstack/react-query-devtools`) for debugging cache state

### Negative

- Complex cross-query dependencies (e.g., invalidating version data when EA is published) require careful query key design
- No centralized state snapshot for debugging — state is distributed across individual query caches
- Some developers unfamiliar with cache invalidation patterns over explicit state updates

## Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
|-------------|------|------|----------------|
| Redux Toolkit + RTK Query | Mature, centralized state, good DevTools | Heavy boilerplate for a server-state-heavy app, adds complexity we don't need | Overkill for server-state |
| Zustand | Lightweight, minimal boilerplate | Still requires manual fetch/cache logic, no background refetching | Missing query features |
| SWR | Similar to React Query, by Vercel | Less feature-rich (no mutation support, less mature DevTools) | Feature gaps |
