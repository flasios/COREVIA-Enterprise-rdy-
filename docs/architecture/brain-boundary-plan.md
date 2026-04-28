# COREVIA Brain Boundary Plan

Date: 2026-03-10

## Purpose

This document defines how to make the COREVIA Brain visibly first-class in the repository without breaking the current system.

## Current Physical Boundary

The Brain now lives at the top-level canonical root:

- `brain/`

Current structure includes:

- `agents/`
- `intelligence/`
- `layers/`
- `orchestration/`
- `pipeline/`
- `reasoning/`
- `spine/`
- `storage/`
- `tests/`

The Brain is a first-class subsystem with full top-level visibility.

## Architectural Problem

Previously, the Brain was hidden inside `server/core/corevia/`. That has been resolved — the Brain now lives at the top-level `brain/` root, making the layered model `platform -> brain -> domains -> interfaces -> apps` immediately visible.

## Target Semantic Boundary

The intended target is:

```text
brain/
  pipeline/
  layers/
  reasoning/
  orchestration/
  plugins/
  agents/
  control-plane/
  spine/
  storage/
```

This is the architecture target, not an instruction to move everything immediately.

## Public Brain Surface

See also:

- [brain-public-surface-contract.md](brain-public-surface-contract.md)

Before any large path move, the Brain should expose and protect a public surface.

That surface should center on:

1. pipeline execution entrypoints,
2. decision resume / approval continuation entrypoints,
3. policy-aware Brain service APIs,
4. Brain route registration surface where required,
5. stable Brain types that external modules are allowed to use.

Everything else should be treated as Brain-internal unless deliberately exported.

## Safe Migration Strategy

### Phase 1: Declare the boundary

- document the Brain as a first-class subsystem,
- identify the allowed external entrypoints,
- reduce accidental deep imports into Brain internals.

### Phase 2: Create stable public surfaces

- add barrel exports or alias points for approved Brain entrypaths,
- make orchestrator, control-plane, and spine access explicit,
- distinguish Brain runtime APIs from Brain internal implementation.

### Phase 3: Rationalize internal naming

- clarify whether `intelligence/` maps to reasoning engines,
- clarify where orchestration responsibilities sit,
- keep plugins, agents, and spine concerns visibly separated.

### Phase 4: Evaluate physical relocation or aliasing

- either create a top-level `brain/` alias surface first,
- or perform selective moves when import migration can be automated and verified.

## Recommended Internal Shape Adjustments

These are the most useful structural clarifications before any big rename:

### A. Distinguish orchestration from reasoning

Current areas such as `pipeline/`, `intelligence/`, and `control-plane.ts` should read as separate responsibilities:

- pipeline flow control,
- reasoning engine execution,
- control-plane and policy/runtime governance.

### B. Keep spine and policy semantics explicit

The Decision Spine should remain visibly distinct from generic services.

### C. Avoid bypass paths

Any feature needing governed generation or decision logic should call into approved Brain surfaces rather than directly invoke provider logic or hidden internal helpers.

## Import Discipline Rules

The following rules should become explicit:

1. domain modules do not deep-import arbitrary Brain internals,
2. Brain routes are not the same thing as Brain core execution,
3. platform AI infrastructure may support the Brain but does not replace it,
4. learning and memory remain approval-gated.

## Immediate Repo Action Candidates

1. inventory all imports into `brain/` from outside the Brain,
2. identify the smallest stable public entrypoint set,
3. define alias or barrel candidates for those entrypoints,
4. keep all new AI generation paths routed through Brain-governed surfaces.

## Success Criteria

This plan is working when:

- engineers can identify the Brain immediately in the repository,
- new features do not bypass governed Brain surfaces,
- Brain internal structure becomes easier to evolve without broad ripple effects,
- the system architecture reads naturally as `platform -> brain -> domains -> interfaces -> apps`.