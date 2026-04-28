# ADR-0014: Governed AI Control Plane Over Direct AI Feature Integration

> **Status:** accepted
>
> **Date:** 2026-03-10
>
> **Deciders:** Founder Office, Enterprise Architecture, AI Governance Lead, Platform Architecture

## Context

COREVIA's strategic differentiation depends on how AI is governed, not merely on whether AI is used.

The platform already includes the Brain, an 8-layer pipeline, decision spine logic, classification controls, validation gates, and approved-only learning patterns. A formal decision is needed so future development does not erode this model by adding direct AI shortcuts.

## Decision

We adopt a **governed AI control plane** as the only acceptable architecture model for critical AI capabilities in COREVIA.

This means:

- classification occurs before critical reasoning,
- policy and routing rules determine which engines may run,
- sovereign and hybrid execution zones remain distinct,
- validation and HITL are first-class governance controls,
- only approved outcomes may feed institutional learning,
- AI-generated artifacts require provenance, versioning, and approval-state awareness.

The Brain and Decision Spine therefore remain architectural control-plane assets, not optional feature infrastructure.

## Consequences

### Positive

- COREVIA maintains enterprise trust and explainability.
- AI usage remains consistent with sovereign and regulated deployment expectations.
- Model-routing, policy, and approval semantics remain centrally governable.
- Institutional learning remains safer because it is restricted to approved outcomes.

### Negative

- Teams lose the ability to add fast, ungoverned AI shortcuts for convenience.
- Some product features may take longer to ship because they must fit the control model.
- Governance exceptions now need explicit decision records instead of quiet implementation choices.

### Neutral

- Not every minor assistive AI interaction must be equally heavyweight, but anything that affects enterprise decisions, artifacts, approval flows, or downstream actions must respect the control-plane model.
- External models remain allowed only under explicit classification and policy constraints.

## Implementation Notes

The architecture is now beginning to enforce this decision in repository structure and tooling, not only in narrative.

Current implementation signals include:

- `brain/index.ts` serves as the approved public Brain barrel for external consumers,
- external code is expected to import Brain capabilities through `@brain`,
- ESLint `no-restricted-imports` rules in `eslint.config.js` block deep imports into `@brain/*` from outside the Brain subtree,
- the architecture contract is documented in `docs/architecture/brain-public-surface-contract.md`.

This keeps the governed AI control plane explicit in both code organization and boundary enforcement.