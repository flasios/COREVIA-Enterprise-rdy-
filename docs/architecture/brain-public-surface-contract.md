# COREVIA Brain Public Surface Contract

Date: 2026-03-10

## Purpose

This document defines the first stable public surface for the COREVIA Brain based on actual external imports in the repository.

## Current External Consumers

Observed external consumers include:

- `domains/demand/application/buildDeps.ts`
- `platform/decision/decisionOrchestrator.ts`
- `domains/intelligence/infrastructure/brainDraftArtifactService.ts`
- `domains/intelligence/infrastructure/brainCore.adapter.ts`
- `domains/intelligence/infrastructure/dashboardReadStore.adapter.ts`
- `domains/portfolio/infrastructure/brainPipeline.ts`
- `domains/portfolio/infrastructure/wbsGeneratorService.ts`
- `domains/intelligence/api/registerIntelligenceRoutes.ts`
- `domains/intelligence/api/index.ts`
- `domains/intelligence/api/ai-assistant.routes.ts`
- `apps/api/bootstrap/index.ts`

## Approved Public Surface

The initial approved public surface is exposed through:

- `brain/index.ts`

The following exports are approved for external use:

### Core execution

- `coreviaOrchestrator`
- `CoreviaOrchestrator`

### Brain persistence

- `coreviaStorage`
- `CoreviaStorage`

### Decision Spine

- `SpineOrchestrator`

### Brain services

- `demandSyncService`
- `DemandSyncService`

### Governed redaction surface

- `redactionGateway`
- `RedactionGateway`

### Control-plane read and update surface

- `getControlPlaneState`
- `getLayerConfig`
- `getLayerConfigs`
- `loadLayerConfigsFromDB`
- `setAgentThrottle`
- `setIntakeEnabled`
- `setPolicyMode`
- `updateLayerConfig`

### Route composition surface

- `coreviaRoutes`

### Bootstrap seed surface

- `seedCoreviaData`
- `seedGateCheckCatalog`

## Import Rule

External code should prefer:

- `@brain`

External code should avoid deep imports into Brain internals unless a symbol is intentionally not yet represented in the public surface and the use is temporary.

Current state on 2026-03-10:

- representative external consumers have been migrated to the public barrel,
- the codebase currently has no remaining deep `@brain/*` imports outside the Brain subtree,
- ESLint now enforces this boundary.

## Deep Import Risk Areas

The following historical deep-import patterns have been eliminated:

- `@brain/pipeline/orchestrator`
- `@brain/storage`
- `@brain/spine/spine-orchestrator`
- `@brain/intelligence/redaction-gateway`
- direct seed imports from `seeds/*`

## What Is Not Public Yet

The following areas should still be treated as Brain-internal by default:

- individual layer implementations,
- most `intelligence/*` internals other than explicitly exported gateways,
- route submodules under `routes/*`,
- storage internals beyond the exported storage entrypoints,
- plugin internals,
- agent internals,
- most seed internals beyond approved bootstrap functions.

## Transition Guidance

### Immediate

- new external imports should prefer the public barrel,
- legacy deep imports may remain temporarily where changing them adds unnecessary churn.

### Near term

- convert representative external consumers to the barrel,
- track any remaining deep imports as candidates for either public export or refactor.

### Medium term

- enforce Brain import boundaries through linting or path restrictions once the public surface is stable.

This is now partially implemented through `no-restricted-imports` in `eslint.config.js`.

## Architectural Intent

This contract is the first implementation step toward making the Brain a visibly first-class subsystem while preserving migration safety.