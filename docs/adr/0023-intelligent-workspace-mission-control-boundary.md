# ADR-0023: Intelligent Workspace As Mission-Control Experience Over Existing Control Surfaces

> **Status:** accepted
>
> **Date:** 2026-03-13
>
> **Deciders:** Founder Office, Enterprise Architecture, Platform Architecture, Workspace Domain Owners

## Context

COREVIA now exposes an Intelligent Workspace that brings together enterprise signals, pending decisions, knowledge context, and governed agent workflows into one operator-facing experience.

Without an explicit architecture decision, this surface could easily drift into one of two failure modes:

- a second control plane that duplicates Brain, Decision Spine, or governance responsibilities, or
- a thin frontend mashup that reaches into multiple subsystems directly and erodes bounded-context ownership.

The repository already has accepted decisions for:

- platform workspace architecture in [0012-platform-workspace-architecture.md](0012-platform-workspace-architecture.md),
- modular bounded-context ownership in [0013-modular-domain-ownership.md](0013-modular-domain-ownership.md), and
- governed AI control-plane behavior in [0014-governed-ai-control-plane.md](0014-governed-ai-control-plane.md).

The Intelligent Workspace needs its own decision record so teams know exactly what it owns, what it must consume, and what it must not replace.

## Decision

We define the Intelligent Workspace as a **mission-control experience and aggregation boundary**, not as a separate decision system.

The governing model is:

- `apps/web/modules/workspace` owns the operator-facing mission-control experience.
- `domains/workspace` owns the aggregation, normalization, and workflow-launch API surface for that experience.
- `brain` remains the governed AI and decision-routing control plane.
- Decision Spine remains the canonical source of governed decisions and decision status.
- Knowledge bounded-context services remain the canonical source of document, graph, and briefing context.

The Intelligent Workspace is therefore allowed to:

- aggregate live decision, signal, task, and context inputs for operator consumption,
- normalize multiple platform/domain outputs into a coherent workspace brief,
- launch governed agent workflows through approved Brain public surfaces,
- provide human review surfaces for pending decisions and generated outputs.

The Intelligent Workspace is not allowed to:

- introduce a parallel approval or governance model,
- bypass Brain routing or call hidden agent internals directly,
- assume ownership of source-domain business rules that belong to demand, knowledge, governance, portfolio, or identity,
- move orchestration complexity into the browser when the backend aggregation boundary should own it.

Implementation expectations:

- frontend ownership lives under `apps/web/modules/workspace`,
- backend ownership lives under `domains/workspace` with standard `api -> application -> domain -> infrastructure` layering,
- external Brain usage must go through approved public surfaces,
- workspace-specific workflows may map onto existing governed Brain agents but must not invent ungoverned runtime shortcuts,
- workspace APIs should return operator-ready, mission-control shaped models rather than leaking raw subsystem structures to the UI.

## Consequences

### Positive

- The Intelligent Workspace has explicit ownership without weakening existing bounded contexts.
- Brain and Decision Spine remain the only control-plane authorities for governed AI and decision flow.
- The UI can evolve as a strong operator experience without coupling the browser to multiple subsystem internals.
- Future teams have a clear rule for where workspace aggregation logic belongs.

### Negative

- Workspace feature teams must spend more effort on aggregation contracts and model shaping instead of shortcutting directly into source services.
- Some apparently convenient UI-side integrations will now be considered architectural violations.
- New workspace scenarios may require backend composition work before the UI can ship them cleanly.

### Neutral

- Workspace-branded workflow templates may differ from the names of underlying Brain agents as long as the mapping remains governed and explicit.
- The Intelligent Workspace can become a primary operator surface without becoming a new system of record.

## Alternatives Considered

| Alternative | Pros | Cons | Why not chosen |
|-------------|------|------|----------------|
| Treat the Intelligent Workspace as a second control plane | Fast to prototype by centralizing everything in one module | Duplicates governance, weakens Decision Spine authority, increases long-term inconsistency | Rejected because COREVIA already has a governed control-plane model |
| Build the Workspace as frontend-only composition over many APIs | Minimizes backend work initially | Pushes orchestration into the browser, leaks subsystem contracts, complicates security and consistency | Rejected because operator-facing normalization belongs in a bounded backend surface |
| Fold Workspace concerns into Brain directly | Keeps aggregation near AI capabilities | Mixes operator experience concerns into the control plane and over-expands Brain ownership | Rejected because Brain should remain a governed control surface, not a product-facing aggregation context |