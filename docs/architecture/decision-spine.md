# COREVIA Brain And Decision Spine

Date: 2026-03-10

## Purpose

This document explains the architectural role of the COREVIA Brain and why it should be visible as a first-class repository boundary.

## Architectural Role

The Brain is the governed reasoning engine of the platform.

It is responsible for:

- normalizing demand and route intent,
- classifying data and sensitivity,
- enforcing policy before reasoning,
- selecting orchestration plans and engines,
- validating output quality and authority thresholds,
- requiring HITL where required,
- preserving append-only decision evidence,
- enabling approved-only learning.

The Decision Spine is the continuity layer for governed decision state across this flow.

## Current Physical Location

The Brain now lives at the canonical top-level root:

- `brain/`

Key internal areas include:

- `pipeline/`
- `layers/`
- `spine/`
- `reasoning/`
- `orchestration/`
- `storage/`

The Brain has full repository-level visibility as a first-class subsystem.

## Target Semantic Boundary

The Brain should eventually read as:

```text
brain/
  pipeline/
  layers/
  reasoning/
  orchestration/
  plugins/
  agents/
  control-plane/
```

This is a semantic target. It should be approached in a controlled way rather than with an immediate disruptive move.

## Core Invariants

The following rules must remain true regardless of physical folder changes:

1. Policy precedes reasoning.
2. Classification drives routing and controls.
3. No bypass path may skip validation or approval semantics.
4. Decision evidence remains append-only wherever possible.
5. Learning may only derive from approved outcomes.

## Why This Boundary Matters

Making the Brain explicit helps in five ways:

1. It shows reviewers where the strategic differentiation of the platform lives.
2. It separates governed reasoning from generic application code.
3. It reduces the risk of Brain logic being treated like ordinary business services.
4. It clarifies ownership for policy, routing, validation, and learning.
5. It makes future control-plane hardening easier to reason about.

## Transition Guidance

The preferred path is:

1. document and preserve the current Brain boundary,
2. reduce accidental imports into Brain internals,
3. define a public Brain surface,
4. only then consider controlled path moves or aliases.

## Primary References

- [../COREVIA_BRAIN_FULL_REFERENCE.md](../COREVIA_BRAIN_FULL_REFERENCE.md)
- [../COREVIA_TARGET_ENTERPRISE_ARCHITECTURE_2026-03-10.md](../COREVIA_TARGET_ENTERPRISE_ARCHITECTURE_2026-03-10.md)
- [REPOSITORY_STRUCTURE_EXECUTION_PLAN.md](REPOSITORY_STRUCTURE_EXECUTION_PLAN.md)