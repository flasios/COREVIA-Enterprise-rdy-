# COREVIA Architecture Docs

This folder is the architecture landing zone for engineers, architects, and reviewers who need to understand the system quickly.

The intended reading order is:

1. [system-overview.md](system-overview.md)
2. [REPOSITORY_STRUCTURE_TRANSITION.md](REPOSITORY_STRUCTURE_TRANSITION.md)
3. [REPOSITORY_STRUCTURE_EXECUTION_PLAN.md](REPOSITORY_STRUCTURE_EXECUTION_PLAN.md)
4. [decision-spine.md](decision-spine.md)
5. [brain-boundary-plan.md](brain-boundary-plan.md)
6. [interface-layer-map.md](interface-layer-map.md)
7. [interface-file-move-matrix.md](interface-file-move-matrix.md)
8. [brain-public-surface-contract.md](brain-public-surface-contract.md)
9. [domain-model.md](domain-model.md)
10. [MODULE_STANDARD.md](MODULE_STANDARD.md)
11. [deployment.md](deployment.md)
12. [ENTERPRISE_LAUNCH_PLAN.md](ENTERPRISE_LAUNCH_PLAN.md)
13. [FILESYSTEM_TRANSITION_PLAN.md](FILESYSTEM_TRANSITION_PLAN.md)

For launch execution and go-live control, use the adjacent operational set under `docs/`:

- `../LAUNCH_READINESS_CHECKLIST.md`
- `../RELEASE_RUNBOOK.md`
- `../ROLLBACK_RUNBOOK.md`
- `../STAGING_SMOKE_GATE.md`
- `../uae-evidence-pack/signoff-template.md`

## Architecture Message

COREVIA should read as:

`platform -> brain -> domains -> interfaces -> apps`

That is the architectural intent behind the repository, even where some physical folders still use transitional names.

The canonical target filesystem names are:

- `apps/web`
- `apps/api`
- `brain`
- `domains`
- `platform`
- `interfaces`
- `packages`
- `infrastructure`

Current execution status:

- the web root has already moved physically to `apps/web`
- the canonical top-level roots now exist at `apps/api`, `brain`, `domains`, `platform`, `interfaces`, and `infrastructure`
- `brain`, `platform`, and `domains` now exist as real top-level directories
- `interfaces` is now a real top-level directory with real `config`, `middleware`, `storage`, `types`, `http`, and `websocket` subtrees, while deeper transport internals are still being converged
- the first high-traffic canonical children are now real wrapper-owned directories at `platform/db`, `platform/logging`, `platform/security`, `domains/intelligence`, and `domains/portfolio`
- the next high-traffic canonical children are now real wrapper-owned directories at `platform/ai`, `platform/notifications`, `platform/events`, `domains/demand`, and `domains/knowledge`
- additional canonical roots are now physical at `platform/audit`, `platform/decision`, `platform/storage`, `domains/ea`, and `domains/governance`, and selected demand/knowledge child files now have wrapper-owned canonical files under `domains/demand/application`, `domains/demand/infrastructure`, and `domains/knowledge/infrastructure`
- the next small live roots are now physical at `platform/cache`, `platform/config`, `platform/crypto`, `platform/http`, `domains/operations`, and `domains/notifications`, with canonical wrappers in place for the used public entrypoints and ESLint coverage extended accordingly
- the next low-risk roots are now physical at `platform/observability`, `platform/typing`, `platform/feature-flags`, `domains/compliance`, `domains/identity`, and `domains/integration`, with wrapper-owned canonical root files and lint coverage extended to those surfaces
- the remaining low-risk platform cleanup roots are now physical at `platform/dlp`, `platform/retention`, `platform/telemetry`, `platform/tts`, and `domains/platform`, with canonical wrappers added and lint coverage extended to those surfaces
- child-level canonical ownership is now expanding inside physical domain roots: `domains/governance/application`, `domains/governance/infrastructure`, `domains/operations/application`, `domains/operations/infrastructure`, `domains/notifications/application`, and `domains/notifications/infrastructure` now own their barrel files directly, with `buildDeps` wrappers added where those application surfaces expose them
- the next child-level canonical wave now covers `domains/compliance/application`, `domains/compliance/infrastructure`, `domains/identity/application`, `domains/identity/infrastructure`, `domains/integration/application`, and `domains/integration/infrastructure`, with direct canonical barrels and `buildDeps` wrappers for the application surfaces
- demand and knowledge child-level ownership has now expanded further: `domains/demand/api`, `domains/knowledge/api`, and `domains/knowledge/application` are real directories with direct canonical barrel/register/buildDeps files while their remaining route and use-case files stay linked for compatibility
- the canonical top-level runtime and operations roots now live under `apps/*` and `infrastructure/*`; the legacy `server/` tree has been fully deleted

## Relationship To Existing Docs

This folder does not replace the broader architecture package already present under `docs/`.

It provides the fast-entry architecture set.

The wider authoritative material remains in:

- [../ARCHITECTURE.md](../ARCHITECTURE.md)
- [../adr/0023-intelligent-workspace-mission-control-boundary.md](../adr/0023-intelligent-workspace-mission-control-boundary.md)
- [../COREVIA_TARGET_ENTERPRISE_ARCHITECTURE_2026-03-10.md](../COREVIA_TARGET_ENTERPRISE_ARCHITECTURE_2026-03-10.md)
- [../COREVIA_ENTERPRISE_ARCHITECTURE_PACKAGE_2026-03-10.md](../COREVIA_ENTERPRISE_ARCHITECTURE_PACKAGE_2026-03-10.md)
- [../COREVIA_BRAIN_FULL_REFERENCE.md](../COREVIA_BRAIN_FULL_REFERENCE.md)

## Folder Contents

- [system-overview.md](system-overview.md): concise architecture and layering summary
- [REPOSITORY_STRUCTURE_TRANSITION.md](REPOSITORY_STRUCTURE_TRANSITION.md): current-to-target repository shape
- [REPOSITORY_STRUCTURE_EXECUTION_PLAN.md](REPOSITORY_STRUCTURE_EXECUTION_PLAN.md): concrete move candidates and sequencing
- [decision-spine.md](decision-spine.md): Brain, pipeline, control-plane, and Decision Spine summary
- [brain-boundary-plan.md](brain-boundary-plan.md): safe migration plan for surfacing the Brain as a first-class repository boundary
- [interface-layer-map.md](interface-layer-map.md): current transport/composition inventory and interface convergence map
- [interface-file-move-matrix.md](interface-file-move-matrix.md): file-by-file current-to-target move guidance for transport and middleware files
- [brain-public-surface-contract.md](brain-public-surface-contract.md): approved external Brain entrypoints and deep-import reduction contract
- [domain-model.md](domain-model.md): bounded contexts and ownership model
- [MODULE_STANDARD.md](MODULE_STANDARD.md): implementation-facing standard for backend and frontend module shape
- [deployment.md](deployment.md): runtime, containers, and environment topology
- [ENTERPRISE_LAUNCH_PLAN.md](ENTERPRISE_LAUNCH_PLAN.md): phased plan to reach launch-grade enterprise readiness
- [FILESYSTEM_TRANSITION_PLAN.md](FILESYSTEM_TRANSITION_PLAN.md): concrete phase plan for moving from legacy `client/server/shared` roots to `apps/brain/domains/platform/interfaces/packages/infrastructure`

Operational launch execution is now defined outside this folder in:

- [../LAUNCH_READINESS_CHECKLIST.md](../LAUNCH_READINESS_CHECKLIST.md)
- [../RELEASE_RUNBOOK.md](../RELEASE_RUNBOOK.md)
- [../ROLLBACK_RUNBOOK.md](../ROLLBACK_RUNBOOK.md)
- [../STAGING_SMOKE_GATE.md](../STAGING_SMOKE_GATE.md)

The Brain boundary is no longer only documented. It is now partially enforced in code through the public barrel at `brain/index.ts`, the surfaced `brain/` root, and the corresponding `no-restricted-imports` rule in `eslint.config.js`.

As of 2026-03-11, the canonical repository roots are surfaced directly in the filesystem and the operational root is now physically consolidated under `infrastructure/`. The remaining migration work is primarily internal implementation retirement and documentation cleanup.
