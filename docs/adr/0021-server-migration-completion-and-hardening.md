# ADR-0021: Server Migration Completion & Post-Migration Hardening

> **Status:** accepted
>
> **Date:** 2026-03-13 (Phase F completed 2026-03-14)
>
> **Deciders:** Platform Architecture Team
>
> **Supersedes:** ADR-0020 (migration plan — now completed, Phase F executed)

## Context

ADR-0020 defined a phased plan to migrate all 602 TypeScript files from the
legacy `server/` tree to canonical roots (`brain/`, `domains/`, `interfaces/`,
`platform/`, `apps/`). The plan was organized into Phases A–F with per-domain
migration units.

As of 2026-03-13, the migration is **100% complete** and as of 2026-03-14,
**Phase F (server/ deletion) has been executed**:

| Metric | Value |
|---|---|
| Total `server/*.ts` files | 602 → **0 (deleted)** |
| Files converted to compatibility facades | 602 (100%) → deleted |
| Real code files in canonical roots | 779 |
| Stale `server/` imports in canonical roots | 0 |
| Build output (esbuild, `packages: external`) | 4.5 MB / ~70 ms |
| Build entries reaching canonical roots | 530 files |

The `server/` directory has been **permanently removed** (607 files, 2.4 MB).
All configs, scripts, CI/CD pipelines, and ESLint rules have been updated to
reference canonical roots exclusively.

## Decision

### 1. Migration Declared Complete — `server/` Deleted

- All 602 `server/*.ts` facade files have been **deleted** (Phase F executed).
- The `server/` directory no longer exists in the repository.
- Canonical roots (`brain/`, `domains/`, `interfaces/`, `platform/`) own all
  implementation.

### 2. ESLint Deprecation Guard

A new `no-restricted-imports` rule block in `eslint.config.js` prevents
canonical roots from importing `server/` paths:

```javascript
{
  files: ["brain/**/*.ts", "domains/**/*.ts", "interfaces/**/*.ts", "platform/**/*.ts"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{
        group: ["@server/*", "@server/**", "**/server/*", "**/server/**"],
        message: "Canonical roots must not import from server/. Use @platform/*, @domains/*, @brain/*, @interfaces/* aliases instead."
      }]
    }]
  }
}
```

This ensures canonical roots never develop reverse dependencies on the facade
layer.

### 3. TypeScript Strict-Mode Hardening

`tsconfig.json` has `strict: true` and `noUncheckedIndexedAccess: true` both
enabled. The flag was initially deferred (1,514 errors), then systematically
remediated — 1,470 bracket-access errors fixed across 196 files using guarded
non-null assertions, null-coalescing defaults, optional chaining, and type
narrowing. Zero TypeScript errors remain.

### 4. Vitest Alias Correction

`vitest.server.config.ts` module aliases were updated from legacy paths to
canonical roots:

| Alias | Before | After |
|---|---|---|
| `@brain` | `./server/core/corevia` | `./brain` |
| `@domains` | `./server/modules` | `./domains` |
| `@platform` | `./server/platform` | `./platform` |
| `@interfaces` | `./server` | `./interfaces` |

Test discovery patterns already included canonical roots (`brain/**/*.{test,spec}.ts`, etc.) — this fix ensures aliased imports in tests resolve to the real code, not facades.

### 5. tsconfig.json Path Resolution — Canonical Only

All `paths` entries resolve **exclusively** to canonical roots. `server/`
fallbacks have been removed:

```json
"@brain/*": ["./brain/*"],
"@domains/*": ["./domains/*"],
"@platform/*": ["./platform/*"],
"@interfaces/*": ["./interfaces/*"]
```

No fallback paths exist. TypeScript, esbuild, and vitest all resolve directly
to canonical code.

### 6. Bundle Analysis

| Metric | Value |
|---|---|
| Output size (unminified + sourcemap) | 4.5 MB + 8.1 MB |
| Output size (minified, no sourcemap) | 2.56 MB |
| Input files bundled | 530 |
| Externalized | All `node_modules` via `packages: "external"` |
| Tree-shaking | Active (esbuild default) |
| Top contributor | `documentAgent.ts` (186 KB) |

4.5 MB is optimal for this scope. All top contributors are real business logic
(brain reasoning, document processing, financial models, AI services). No dead
code or unnecessary dependencies detected. Minification is not applied
server-side to preserve stack trace readability.

### 7. File Structure Cleanup

Post-migration artifacts removed:

- 135 orphaned `dist/` directories (100 in canonical roots, 35 in `server/`) —
  stale `tsc` compilation outputs (215 files, ~3.5 MB)
- 15 `.DS_Store` macOS metadata files
- 4 empty placeholder directories (`server/microservices/`, `.devcontainer/`,
  `infrastructure/gateway/`, `postgres/`)

## Consequences

### Positive

- **Ownership is unambiguous.** Every line of real code lives in its
  architectural layer. `server/` no longer exists — zero ambiguity.
- **Lint guard prevents regression.** ESLint blocks any `@server/*` or
  `**/server/**` imports across all canonical roots and apps.
- **2.4 MB removed.** 607 facade files deleted, reducing repo size and
  cognitive overhead.
- **Build unaffected.** Output remains 4.5 MB / ~70 ms — identical to
  pre-deletion, confirming facades carried zero unique code.
- **Test tooling resolves canonical code.** No risk of tests running against
  facade re-exports instead of real implementations.

### Negative

- ~~`noUncheckedIndexedAccess` deferred~~ — **resolved**: 1,470 errors fixed
  across 196 files; flag is now enabled.
- ~~22 pre-existing type errors~~ — **resolved**: all fixed (Learning.tsx
  queryFn cast, engine.routes filter type, knowledge port widening,
  ingestion null-coalescing, script type declarations).

### Phase F Execution Details (2026-03-14)

Migration steps executed:

1. **Audit** — 13 hard dependencies on `server/` paths found across configs,
   build scripts, test commands, quality scripts, and CI workflows. Zero source
   code imports from canonical roots into `server/`.
2. **Config migration** — Updated 10 files: `tsconfig.json`, both vitest
   configs, `build-server.mjs`, `run-api-dev.mjs`, `Makefile`, `package.json`
   (3 test scripts), `check-ts-nocheck-baseline.sh`,
   `check-corevia-ai-boundary.ts`, `check-platform-ai-boundary.ts`.
3. **ESLint overhaul** — Removed 5 `server/`-specific rule blocks, migrated
   DDD layer rules from `server/modules/*` to `domains/*`, consolidated
   canonical-root guard to cover all roots + apps + infrastructure.
4. **CI/CD update** — `security-gate.yml` ESLint enforcement updated from
   `server/modules/**/*.ts` to canonical root patterns.
5. **Deletion** — `rm -rf server/` — 607 files, 2.4 MB removed.
6. **Import repair** — Created barrel files (`interfaces/types/index.ts`,
   `interfaces/middleware/index.ts`), fixed cross-layer relative imports to use
   `@platform/*` and `@interfaces/*` aliases, resolved export name collisions.
7. **Validation** — Build GREEN (4.5 MB / 67 ms), ESLint 0 errors,
   security tests 16/16 pass, regression tests 23/23 pass, quality scripts
   all passing.

### Next Steps

1. ~~`noUncheckedIndexedAccess` hardening~~ — **done**: 1,470 errors fixed
   across 196 files, flag enabled, zero `tsc` errors.
2. ~~Pre-existing type errors~~ — **done**: all 22 errors resolved.
3. **Coverage expansion** — extend vitest coverage `include` to all canonical
   root directories.
4. **ADR-0022** — monorepo tooling evaluation now that `server/` is gone.
