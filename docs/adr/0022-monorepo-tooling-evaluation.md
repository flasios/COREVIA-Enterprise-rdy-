# ADR-0022: Monorepo Tooling Evaluation — Stay with Single-Package + Makefile

> **Status:** accepted
>
> **Date:** 2026-03-14
>
> **Deciders:** Platform Architecture Team
>
> **Context:** Post-`server/` deletion (ADR-0021 Phase F), evaluate whether to
> adopt Nx, Turborepo, pnpm workspaces, or continue with the current
> single-package approach.

## Context

With the `server/` tree removed and all code consolidated under canonical roots
(`brain/`, `domains/`, `interfaces/`, `platform/`, `apps/`), the codebase now
has a clean modular layout that naturally raises the question: should we adopt
dedicated monorepo tooling?

### Current Tooling Stack

| Concern | Tool | Notes |
|---|---|---|
| Package management | npm (single `package.json`) | ~140 deps, no workspace splitting |
| Server build | esbuild (3 scripts) | API, worker, ai-service → `dist/` |
| Client build | Vite | React SPA, code-split by feature |
| Type checking | `tsc --noEmit` | Strict + `noUncheckedIndexedAccess` |
| Test runner | Vitest (2 configs) | Server (node) + client (jsdom) |
| Linting | ESLint flat config | Architecture boundary rules built-in |
| Task orchestration | Makefile + npm scripts | 30+ scripts, 20+ Make targets |
| Architecture enforcement | Custom TS scripts (5) | Boundary, AI-boundary, ts-nocheck, bundle budget |
| CI | GitHub Actions | Security gate, quality gate |
| Containers | Docker multi-stage | 4 Dockerfiles, compose with 5 services |
| Deployment | Helm + Azure scripts | Staging / production |

### Build Performance (baseline)

| Target | Time | Output |
|---|---|---|
| `build:server` | ~120 ms | 4.5 MB |
| `build:processing-worker` | ~80 ms | ~2 MB |
| `build:ai-service` | ~50 ms | ~1 MB |
| `build:client` (Vite) | ~8 s | Chunked SPA |
| `tsc --noEmit` | ~12 s | Type-only |
| Full `npm run build` | ~25 s | All targets |

### Deployable Units

1. **API** — `apps/api/index.ts` → `dist/index.js`
2. **Processing Worker** — `apps/worker/index.ts` → `dist/worker/index.js`
3. **AI Service** — `apps/ai-service/index.ts` → `dist/ai-service/index.js`
4. **Web SPA** — `apps/web/` → `dist/public/`

### Team Size

1–3 engineers.

## Options Evaluated

### Option A: Nx

**Pros:**
- Computation caching (local + remote via Nx Cloud)
- `nx affected` — only build/test/lint what changed
- Project graph with dependency awareness
- Generator system for scaffolding
- Built-in ESLint, Jest/Vitest, esbuild plugin ecosystem

**Cons:**
- Significant configuration overhead (`nx.json`, `project.json` per project)
- Requires splitting into workspace packages or Nx-style projects
- Learning curve for generators, executors, task pipeline config
- Nx Cloud dependency for remote caching (vendor lock-in risk)
- Overkill for sub-second builds and a 1–3 person team
- Would require restructuring all custom quality scripts into Nx targets
- TSConfig paths / Vitest aliases need migration to Nx-managed references

**Verdict:** The caching benefit is negligible when the full build completes in
25 seconds. `affected` analysis is valuable at scale (50+ packages), not at our
current granularity.

### Option B: Turborepo

**Pros:**
- Lighter than Nx — primarily a task runner with caching
- `turbo.json` pipeline definition is simple
- Works with existing npm/pnpm workspaces
- Remote caching via Vercel (optional)

**Cons:**
- Still requires workspace splitting (multiple `package.json` files)
- Dependency graph is package-level, not file-level — less precise than our
  custom boundary checks
- No generator/scaffolding story
- Would duplicate what our Makefile already handles
- Remote caching adds Vercel vendor dependency

**Verdict:** Turborepo's value proposition is task caching and parallel
execution. Our builds are already fast and parallelizable via Make. The overhead
of splitting into workspaces doesn't pay off.

### Option C: pnpm Workspaces (no orchestrator)

**Pros:**
- Strict dependency isolation per workspace
- Faster installs via content-addressable store
- Prevents phantom dependencies
- No additional orchestrator needed

**Cons:**
- Migration from npm → pnpm affects all CI, Docker builds, developer setup
- Workspace splitting forces package.json per project — maintenance overhead
- We have no phantom dependency issues today (single package resolves cleanly)
- Doesn't solve task orchestration or caching — we'd still use Makefile

**Verdict:** Dependency isolation is a solution looking for a problem we don't
have. Migration cost is real; benefit is marginal.

### Option D: Stay with Current Approach (selected)

**Pros:**
- Zero tooling overhead — engineers spend time on product, not build config
- Sub-second server builds, 25-second full pipeline — caching unnecessary
- Makefile provides clear, composable task orchestration with no abstractions
- Custom boundary scripts enforce architecture rules that no monorepo tool
  provides out of the box (AI boundary, DDD layer enforcement, ts-nocheck audit)
- Single `package.json` means one lock file, one install, simple Docker COPY
- TSConfig path aliases already provide module boundary ergonomics
- ESLint flat config with `no-restricted-imports` enforces architectural
  boundaries at lint time
- No vendor dependency for build orchestration

**Cons:**
- No computation caching (acceptable at current build times)
- No `affected` analysis for partial CI runs (acceptable at current test suite
  size)
- All apps share one dependency tree (acceptable given tight coupling between
  API/worker/ai-service and shared domain code)

## Decision

**Stay with the current single-package + Makefile + custom scripts approach.**

The monorepo tooling options evaluated (Nx, Turborepo, pnpm workspaces) solve
problems of scale that COREVIA does not yet have:

- Build times are sub-second for server targets
- The team is 1–3 engineers — coordination overhead is near zero
- Architecture enforcement is already stronger than what monorepo tools provide
  (custom boundary scripts, ESLint architecture rules, quality gates)
- Docker builds are straightforward with a single dependency tree

### Re-evaluation Triggers

Adopt monorepo tooling if any of these conditions emerge:

1. **Team grows beyond 5 engineers** and CI contention becomes a bottleneck
2. **Build times exceed 2 minutes** for the full pipeline
3. **Independent versioning** is needed (e.g., ai-service ships on a different
   cadence than the API)
4. **Phantom dependency issues** arise from the shared `node_modules`
5. **External consumers** need to install domain packages independently

## Consequences

### Positive

- No migration cost — no files to restructure, no configs to create
- Engineering focus stays on product and architecture, not build tooling
- Simple onboarding — `npm ci && make dev` is the entire setup
- Docker builds remain a single COPY stage for `package*.json`
- Custom quality scripts continue to work without adaptation

### Negative

- No remote build caching — full CI runs every time (mitigated by fast builds)
- No task-graph-aware partial testing — all tests run on every PR (mitigated by
  small test suite and fast execution)
- If the codebase grows significantly, this decision should be revisited per the
  re-evaluation triggers above

### Neutral

- The `apps/` directory structure and TSConfig path aliases are already
  workspace-ready — migration to workspaces would be mechanical if triggered
- Makefile targets map 1:1 to what Turborepo pipelines would define
