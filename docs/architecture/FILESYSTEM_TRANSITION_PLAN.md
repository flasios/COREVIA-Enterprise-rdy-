# COREVIA Filesystem Transition Plan

Date: 2026-03-10
Status: transition plan in execution; Phase 1 web-root move completed, Phase 2 shared-package move completed, canonical root surfaces now live for apps/api, brain, domains, platform, interfaces, and infrastructure

## Purpose

This plan defines how to physically converge the repository toward the target top-level structure:

```text
corevia/
  apps/
    web/
    api/
  brain/
  domains/
  platform/
  interfaces/
  packages/
  infrastructure/
  docs/architecture/
```

The goal is to make the filesystem match the architecture without breaking the build, local development flow, tests, or deployment automation.

## Canonical Target Names

The following names are the canonical target names for the repository structure and should be used consistently in architecture documentation, transition planning, and future filesystem moves:

- `apps/web`
- `apps/api`
- `brain`
- `domains`
- `platform`
- `interfaces`
- `packages`
- `infrastructure`
- `docs/architecture`

These are not placeholders. They are the intended target names.

## Current Reality

The current repository uses these active physical roots and canonical surfaced boundaries:

- `apps/web/`
- `apps/api/`
- `brain/` (now a real top-level directory; no longer only a compatibility symlink)
- `domains/` (now a real top-level directory with mirrored child links to the active bounded-context tree)
- `platform/` (now a real top-level directory with mirrored child links to the active technical kernel tree)
- `interfaces/` (root and primary transport/config/storage subtrees now exist as real directories)
- `server/`
- `packages/`
- `infrastructure/`
- `uploads/` (runtime data root still retained at top level)

The toolchain is currently wired to those roots in:

- `tsconfig.json`
- `vite.config.ts`
- `vitest.client.config.ts`
- `vitest.server.config.ts`
- `tailwind.config.ts`
- `package.json`
- `eslint.config.js`

That means internal implementation retirement still needs to be staged carefully, even though the target root names are now physically visible.

## Guiding Rule

Do not start by moving folders.

Start by making the toolchain path model compatible with the future structure, then move roots in controlled waves.

## Target Physical Mapping

| Current root | Target root | Notes |
| --- | --- | --- |
| `apps/web/` | `apps/web/` | React SPA root; physical move completed |
| `server/` | `apps/api/` plus extracted top-level roots over time | Backend runtime starts here, but not all server code belongs inside `apps/api` long term |
| `server/core/corevia/` | `brain/` | Strategic Brain boundary |
| `server/modules/` | `domains/` | Bounded contexts |
| `server/platform/` | `platform/` | Technical kernel |
| `server/routes/`, `server/app/routes/`, `server/middleware/`, `server/websocket.ts` | `interfaces/` | Transport and entrypoint layer |
| `shared/` | `packages/` | Shared contracts, schemas, primitives, permissions |
| `scripts/`, `migrations/`, `infra/`, Docker assets, `gateway/`, `charts/` | `infrastructure/` | Deployment and operations grouping |

## Phase 0: Compatibility Preparation

Objective:

- make the build/test/runtime config capable of surviving the future move.

Files to update first:

- `tsconfig.json`
- `vite.config.ts`
- `vitest.client.config.ts`
- `vitest.server.config.ts`
- `tailwind.config.ts`
- `package.json`

Required changes:

1. introduce alias compatibility for future roots without removing current aliases yet.
2. separate frontend and backend path assumptions from hard-coded `client` and `server` directory names.
3. keep `@`, `@shared`, and `@server` working during transition.

Recommended alias additions before any move:

- `@web/*` -> `apps/web/*`
- `@api/*` -> future `apps/api/*`
- `@brain/*` -> future `brain/*`
- `@domains/*` -> future `domains/*`
- `@platform/*` -> future `platform/*`
- `@interfaces/*` -> future `interfaces/*`
- `@packages/*` -> future `packages/*`

Acceptance checks:

- `npm run check`
- `npm run lint`
- `npm run test:client`
- `npm run test`

## Phase 1: Web Root Migration

Current status:

- completed on 2026-03-10

Objective:

- move `client/` to `apps/web/` with minimum logic churn.

Current blockers already resolved in config:

- `vite.config.ts` now uses `apps/web` as the authoritative root
- `vitest.client.config.ts` now targets `apps/web/**/*`
- `tailwind.config.ts` now scans `./apps/web/index.html` and `./apps/web/**/*`
- `tsconfig.json` now includes `apps/web/**/*`

Execution steps:

1. move `client/` to `apps/web/`  ✅
2. update Vite root and aliases  ✅
3. update Vitest client include/setup paths  ✅
4. update Tailwind content globs  ✅
5. update any docs/scripts that refer to `client/`  in progress

Expected post-move path model:

- `apps/web/index.html`
- `apps/web/app`
- `apps/web/modules`
- `apps/web/shared`
- `apps/web/i18n`

Acceptance checks:

- `npm run build:client`
- `npm run test:client`
- `npm run test:e2e`

## Phase 2: Shared Package Migration

Objective:

- move `shared/` to `packages/` without breaking cross-runtime contracts.

Current status:

- physical move completed on 2026-03-10
- `tsconfig.json` maps `@shared/*` -> `./packages/*`
- `vite.config.ts` maps `@shared` -> `packages`
- `vitest.client.config.ts` and `vitest.server.config.ts` both map `@shared` -> `./packages`

Execution steps:

1. move `shared/` to `packages/`  ✅
2. keep `@shared/*` temporarily mapped to `packages/*` for compatibility
3. optionally add `@packages/*` as the canonical future alias
4. update docs to describe `packages/` as the canonical shared-library root

Recommended internal package grouping after move:

- `packages/contracts/`
- `packages/schemas/`
- `packages/primitives/`
- `packages/permissions/`
- `packages/financial/`

Acceptance checks:

- `npm run check`
- `npm run lint`
- `npm run build`

## Phase 3: Brain Surface Extraction

Objective:

- make the Brain physically first-class.

Current advantage:

- the public Brain barrel already exists at `server/core/corevia/index.ts`
- external server code is now being converged toward the canonical `@brain` alias while the legacy Brain path remains compatible
- lint already blocks new deep Brain imports outside the Brain subtree

Execution steps:

1. introduce a top-level `brain/` root or alias surface  ✅
2. keep the Brain public surface stable while the legacy implementation path remains compatible  ✅
3. migrate `server/core/corevia/*` internals into direct `brain/*` ownership in a controlled wave; the top-level `brain/` directory now exists as a real wrapper-owned root
4. update the import aliases after the internal physical move is stable

Recommended initial physical target:

- `brain/pipeline/`
- `brain/layers/`
- `brain/intelligence/` or `brain/reasoning/`
- `brain/plugins/`
- `brain/agents/`
- `brain/spine/`
- `brain/storage/`
- `brain/routes/`

Acceptance checks:

- `npm run check`
- `npm run lint`
- `npm run check:corevia-ai-boundary`
- targeted Brain regression tests

## Phase 4: Interface Layer Extraction

Objective:

- pull transport-facing backend concerns into a clearer `interfaces/` boundary.

Current move candidates:

- `server/routes/index.ts`
- `server/app/routes/registerPlatformRoutes.ts`
- `server/app/routes/registerDomainRoutes.ts`
- `server/middleware/*`
- `server/websocket.ts`

Execution steps:

1. surface route composition into `interfaces/http/`  ✅
2. surface middleware into `interfaces/middleware/`  ✅
3. surface websocket entrypoints into `interfaces/websocket/`  ✅
4. convert primary `interfaces/` child roots (`config`, `middleware`, `storage`, `types`, `vite.ts`) into real canonical filesystem surfaces  ✅
5. keep `server/platform/http/platformServer.ts` in `platform/`
6. retire the legacy `server/` transport implementation paths after import convergence

Acceptance checks:

- `npm run check`
- `npm run lint`
- `npm run test:security`
- `npm run test:regression:gate`

## Phase 5: Domain And Platform Extraction From Server

Objective:

- split the current `server/` root into clearer architecture roots.

Target outcome:

- `apps/api/` for the main backend runtime entrypoint and app bootstrap
- `domains/` for bounded contexts from `server/modules/`
- `platform/` for `server/platform/`

Execution steps:

1. surface `server/modules/` at `domains/`  ✅ and convert the root to a real top-level directory
2. surface `server/platform/` at `platform/`  ✅ and convert the root to a real top-level directory
3. begin replacing mirrored child links with real wrapper-owned canonical modules (`platform/queue`, `domains/workspace`)  ✅
4. convert high-traffic canonical children to real wrapper-owned directories (`platform/db`, `platform/logging`, `platform/security`, `domains/intelligence`, `domains/portfolio`)  ✅
5. convert the next high-traffic canonical children to real wrapper-owned directories (`platform/ai`, `platform/notifications`, `platform/events`, `domains/demand`, `domains/knowledge`)  ✅
6. convert the next live canonical roots to real directories (`platform/audit`, `platform/decision`, `platform/storage`, `domains/ea`, `domains/governance`) and replace selected demand/knowledge linked child files with wrapper-owned canonical files  ✅
7. convert the next small live roots to real directories (`platform/cache`, `platform/config`, `platform/crypto`, `platform/http`, `domains/operations`, `domains/notifications`) and add canonical wrappers for their used public entrypoints  ✅
8. convert the next low-risk roots to real directories (`platform/observability`, `platform/typing`, `platform/feature-flags`, `domains/compliance`, `domains/identity`, `domains/integration`) and add canonical root wrappers for their public surfaces  ✅
9. convert the remaining low-risk platform cleanup roots to real directories (`platform/dlp`, `platform/retention`, `platform/telemetry`, `platform/tts`, `domains/platform`) and add canonical wrappers for their public surfaces  ✅
10. begin child-level canonical ownership inside physical domain roots by converting selected `application` and `infrastructure` directories to real directories and adding wrapper-owned barrel/buildDeps files (`domains/governance`, `domains/operations`, `domains/notifications`)  ✅
11. continue child-level canonical ownership for the next physical domain roots by converting selected `application` and `infrastructure` directories to real directories and adding wrapper-owned barrel/buildDeps files (`domains/compliance`, `domains/identity`, `domains/integration`)  ✅
12. continue child-level canonical ownership inside the heaviest remaining physical roots by converting selected `api` and `application` directories to real directories and adding wrapper-owned barrel/register/buildDeps files (`domains/demand`, `domains/knowledge`)  ✅
13. introduce `apps/api/` as the canonical runtime entrypoint root  ✅
14. update `package.json` scripts currently pointing at legacy backend runtime paths so `apps/api` and canonical infrastructure roots are used  ✅
15. narrow `apps/api/` to runtime bootstrap/composition and retire the legacy `server/` implementation root over time

Current execution status:

- canonical backend imports are now being rewritten toward `@brain`, `@domains`, `@platform`, and `@interfaces`
- `npm run dev` now launches through `infrastructure/scripts/run-api-dev.mjs`
- `npm run build:server` now builds through `infrastructure/scripts/build-server.mjs`
- `npm run docs:api`, boundary checks, and other operational scripts now point at `infrastructure/scripts/*`
- `vitest.server.config.ts` now advertises the canonical backend roots as the primary server-side test surfaces while still resolving to the active implementation tree

Acceptance checks:

- `npm run check`
- `npm run lint`
- `npm run build:server`
- `npm run test`

## Phase 6: Infrastructure Consolidation

Objective:

- group the operational roots into one visible infrastructure package.

Current move candidates now consolidated under `infrastructure/` as real canonical paths.

Target grouping:

- `infrastructure/scripts/`
- `infrastructure/migrations/`
- `infrastructure/deployment/`
- `infrastructure/docker/`

Execution steps:

1. document ownership of each operational root
2. surface Docker, gateway, charts, uploads, scripts, migrations, and infra assets under `infrastructure/`  ✅
3. replace the old symlink-backed operational shell with real canonical files/directories  ✅
4. migrate the remaining dev and CI entrypoints from legacy top-level paths to `infrastructure/`  ✅ for primary local command surfaces
5. keep CI and local-dev entrypoints stable throughout

Acceptance checks:

- `npm run dev:doctor`
- `npm run dev:boot`
- `docker compose config`
- deployment-related script smoke checks

## Order Of Execution

The safest full-repo order is:

1. Phase 0: compatibility preparation
2. Phase 1: `client` -> `apps/web`
3. Phase 2: `shared` -> `packages`
4. Phase 3: Brain surface extraction
5. Phase 4: interface surface extraction
6. Phase 5: surface `apps/api`, `domains`, and `platform`
7. Phase 6: infrastructure surface consolidation

This order avoids the highest-risk breakage early.

## What Should Not Be Done

1. Do not rename `client`, `server`, and `shared` in one commit.
2. Do not move Brain internals before the public surface is stable.
3. Do not fold platform HTTP primitives into interfaces.
4. Do not let the filesystem transition bypass existing boundary rules.
5. Do not move infrastructure roots without updating dev and CI entrypoints first.

## Exit Criteria

The filesystem transition is complete when:

- the top-level tree visibly reads as `apps`, `brain`, `domains`, `platform`, `interfaces`, `packages`, and `infrastructure`,
- build, test, lint, and local dev all run from the new roots,
- compatibility aliases can be removed without breaking consumers,
- architecture documentation matches the physical repository shape rather than a transition state.