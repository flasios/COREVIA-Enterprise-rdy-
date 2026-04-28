# ADR-0012: Platform Workspace Architecture Over Product Silo Architecture

> **Status:** accepted
>
> **Date:** 2026-03-10
>
> **Deciders:** Founder Office, Product Architecture, Platform Engineering

## Context

COREVIA serves multiple enterprise functions: demand management, governance, PMO and portfolio control, enterprise architecture, knowledge, intelligence, and operations.

An architectural choice is required between:

- separate product silos with weak shared control semantics, or
- one enterprise platform with multiple governed workspace experiences.

Given COREVIA's mission, fragmented product architecture would undermine the shared decision model, approval semantics, data lineage, and governance posture.

## Decision

We choose a **platform workspace architecture**.

COREVIA is one platform with multiple role- and domain-oriented workspace experiences, including:

- Demand Workspace
- Governance Workspace
- PMO / Portfolio Workspace
- Enterprise Architecture Workspace
- Knowledge Workspace
- Intelligence Workspace
- Operations / Admin Workspace

All workspaces are governed views over the same enterprise decision backbone and must align to:

- the same decision spine,
- the same identity and control model,
- the same policy posture,
- the same approval semantics,
- and the same enterprise record model.

## Consequences

### Positive

- Shared decision and governance semantics remain consistent across product surfaces.
- Enterprise users experience COREVIA as one operating system rather than disconnected tools.
- Platform services such as identity, audit, observability, and control-plane logic can be reused cleanly.
- Capability ownership can remain modular without fragmenting the product model.

### Negative

- Shared platform coherence places a higher bar on architectural consistency across workspaces.
- Teams cannot optimize purely for local feature velocity if that breaks cross-workspace semantics.
- UX and route design must work harder to avoid one platform feeling monolithic to the user.

### Neutral

- Workspace-specific branding and composition remain acceptable as long as platform governance semantics remain intact.
- Future deployable separation is still possible; the logical platform model remains unified.