# COREVIA Architecture Conformance Checklist

Date: 2026-03-10
Purpose: Convert the enterprise architecture package into an implementation-facing conformance baseline.
Scope: product architecture, code structure, runtime behavior, governance enforcement, operating model, and production evidence.
Primary source: [COREVIA_ENTERPRISE_ARCHITECTURE_PACKAGE_2026-03-10.md](./COREVIA_ENTERPRISE_ARCHITECTURE_PACKAGE_2026-03-10.md)
Secondary source: [COREVIA_ARCHITECTURE_REVIEW_2026-03-10.md](./COREVIA_ARCHITECTURE_REVIEW_2026-03-10.md)
Execution plan: [COREVIA_ARCHITECTURE_CONFORMANCE_EXECUTION_PLAN_2026-03-10.md](./COREVIA_ARCHITECTURE_CONFORMANCE_EXECUTION_PLAN_2026-03-10.md)

## 1. How To Use This Checklist

This checklist exists to answer one question:

- is the repository, product behavior, and operating model making the architecture package true in practice?

Status meanings:

- `Aligned`: materially true in code and operating model
- `Partial`: direction is correct but implementation is incomplete or uneven
- `Gap`: target-state requirement is not yet sufficiently real

Execution rule:

- no major cleanup or feature work should be treated as complete unless it improves one or more checklist items or avoids damaging them

## 2. Current Executive Conformance View

| Domain | Current Status | What Must Become True |
| --- | --- | --- |
| Platform mission and positioning | `Partial` | product behavior consistently reflects governance-first enterprise decision operating system positioning |
| Business capabilities and value streams | `Partial` | capability ownership and value streams are explicit in implementation and delivery planning |
| Bounded contexts and modular ownership | `Partial` | domain boundaries are enforced across UI, server, orchestration, and shared contracts |
| Brain and Decision Spine control plane | `Partial` | governed reasoning, policy gates, validation, and approved-only learning remain central and non-bypassable |
| Architecture-to-execution continuity | `Partial` | approved decisions convert cleanly into project/workspace structures with traceable provenance |
| Knowledge, evidence, and memory systems | `Partial` | knowledge, decision memory, transactional truth, and learning memory are separated intentionally |
| Technology and cloud-native posture | `Partial` | modular monolith runtime remains disciplined, observable, container-ready, and evidence-backed |
| Security, compliance, and auditability | `Partial` | policy evaluation, routing, approvals, and artifact lineage are consistently provable |
| Integration and interoperability | `Gap` | domain-aligned contracts, owners, and classification rules are explicit for enterprise connections |
| Transition architecture and release evidence | `Gap` | roadmap, ADR cadence, release evidence pack, and selective extraction criteria are operationalized |

## 3. Conformance Checklist

## 3.1 Mission, Positioning, and Product Contract

- [ ] COREVIA behaves as an enterprise decision platform rather than a loose collection of feature modules.
- [ ] Demand, governance, EA, portfolio, knowledge, and intelligence workflows are connected through auditable product flows.
- [ ] Product language, artifact flow, and approvals reinforce governance-first positioning rather than generic AI assistant behavior.
- [ ] Executive visibility is supported by stable dashboards, review views, and decision traceability.

Current reading:

- `Partial`: the product direction is clear, but some implementation areas still feel like large feature surfaces rather than one coherent operating model.

## 3.2 Business Capabilities and Value Streams

- [ ] The capability map is reflected in module ownership, roadmap planning, and architecture decisions.
- [ ] The five primary value streams are visible in workflow orchestration and product transitions.
- [ ] Capability ownership is explicit enough that there is no ambiguity over domain accountability.
- [ ] Architecture review and roadmap sequencing follow value-stream and ownership logic rather than ad hoc feature growth.

Current reading:

- `Partial`: capability framing exists in docs, but implementation governance still needs a stronger ownership and value-stream execution model.

## 3.3 Application Architecture and Bounded Contexts

- [ ] Bounded contexts remain the primary application architecture frame.
- [ ] Shared code is limited to technical cross-cutting concerns or explicit contracts, not business-rule leakage.
- [ ] UI workspaces are decomposed into capability-owned subfeatures rather than giant tab files.
- [ ] Route handlers, orchestration services, domain rules, and workflow services remain conceptually separated.
- [ ] No major feature bypasses governance or approval semantics.

Current reading:

- `Partial`: backend direction is strong; frontend structural simplification is actively improving but still incomplete in major workspaces.

## 3.4 Brain, Decision Spine, and AI Governance

- [ ] The Brain 8-layer flow remains the authoritative orchestration model.
- [ ] Policy operations remain the gate before reasoning.
- [ ] Engine A, B, and C responsibilities stay explicitly segmented.
- [ ] HITL remains enforced for high-risk or approval-relevant transitions.
- [ ] Approved-only learning remains true in implementation, not only in narrative.
- [ ] Decision Spine traceability remains visible across artifacts, approvals, and downstream actions.

Current reading:

- `Partial`: strategically strong and differentiated, but must stay ruthless against convenience-driven bypasses and drift.

## 3.5 Data Architecture, Knowledge, and Memory

- [ ] Canonical records are treated as domain-owned enterprise records, not page-local shapes.
- [ ] Decision memory is distinct from transactional truth.
- [ ] Knowledge and evidence architecture stays evidence-supporting, not decision-owning.
- [ ] Learning memory remains controlled and post-approval.
- [ ] Knowledge graph direction is reflected in models, linkages, and evidence traceability.
- [ ] Read-heavy analytics and executive views move toward explicit read-model architecture where justified.

Current reading:

- `Partial`: the conceptual model is good; read-model maturity and graph-style enterprise traceability need more concrete implementation depth.

## 3.6 Technology Architecture and Runtime Shape

- [ ] The system remains a disciplined modular monolith until extraction is justified by evidence.
- [ ] Worker separation is used selectively for heavy async tasks.
- [ ] Redis-backed queue and cache behavior remains explicit and controlled.
- [ ] Containerization and Kubernetes target posture remain credible and maintained.
- [ ] Observability, metrics, and operational control are architecture concerns, not optional extras.

Current reading:

- `Partial`: target posture is credible, but operational evidence is still behind the architectural intent.

## 3.7 Security, Compliance, and Auditability

- [ ] Identity and permission policy are consistently enforced.
- [ ] Data classification policy affects model routing and external usage.
- [ ] Approval and workflow policy are canonical and auditable.
- [ ] Segregation-of-duty and release governance controls are visible in implementation practice.
- [ ] Auditability covers initiator, policy path, engines/plugins used, approval path, classification, artifacts, and triggered actions.

Current reading:

- `Partial`: the architecture is governance-first, but the platform still needs stronger repeatable evidence for enterprise-grade assurance.

## 3.8 Integration and Interoperability

- [ ] APIs are domain-aligned instead of one undifferentiated service surface.
- [ ] Shared request/response contracts are stable and owned.
- [ ] Integration ownership, data classification rules, and retry/audit semantics are explicit.
- [ ] Event-driven and API-first patterns are used intentionally, not opportunistically.

Current reading:

- `Gap`: structural direction is improving, but this area needs a more explicit enterprise interoperability model.

## 3.9 Transition Architecture and Delivery Discipline

- [ ] Phase 1 baseline decisions are locked and actively governing engineering choices.
- [ ] Phase 2 structural simplification is measurable in code and product surfaces.
- [ ] Phase 3 operational maturity is backed by evidence, not intention.
- [ ] Phase 4 selective extraction criteria are agreed and documented before service splitting occurs.
- [ ] ADR cadence is institutionalized for major platform decisions.
- [ ] Release evidence pack standards exist and are repeatable.

Current reading:

- `Gap`: roadmap direction exists, but conformance evidence and operating discipline are not yet complete enough.

## 4. Priority Gaps To Close Next

These are the highest-value gaps between the package and current implementation reality.

### P1. Structural Simplification Of Major Workspaces

Done when:

- large workspace surfaces are decomposed into subfeatures with clearer ownership and lower regression risk

Current state:

- in progress; demand requirements and business case have materially improved, but the overall pattern is not finished across the product

### P1. Capability Ownership And Value-Stream Execution Discipline

Done when:

- architecture ownership is explicit enough to guide roadmap sequencing, review, and operational accountability

Current state:

- partially true in documentation, not yet explicit enough as an implementation governance baseline

### P1. Read-Model And Dashboard Architecture

Done when:

- dashboard and executive views rely on explicit read-model/query architecture instead of page-shaped aggregation logic

Current state:

- still a meaningful architecture gap

### P1. Brain And Policy Discipline Hardening

Done when:

- governed reasoning paths are non-bypassable and approved-only learning remains provable

Current state:

- strong conceptually, but requires continued discipline and evidence

### P2. Release Evidence Pack Standard

Done when:

- quality, architecture, security, deployment, and rollback proof are packaged as a repeatable release artifact

Current state:

- not fully formalized yet

### P2. Integration Ownership And Enterprise Contracts

Done when:

- external connections have explicit owners, contracts, classification rules, and retry/audit semantics

Current state:

- under-specified relative to target-state positioning

## 5. Working Rule For Engineering Decisions

Use this checklist as the evaluation frame for ongoing work.

Before treating a change as valuable, ask:

1. does it strengthen bounded contexts or reduce cross-module leakage?
2. does it reinforce the Brain, policy gates, approvals, or Decision Spine traceability?
3. does it improve architecture-to-execution continuity?
4. does it improve operational evidence, auditability, or conformance?
5. does it make the architecture package more true in the real product?

If the answer is no, the work may still be useful, but it is not architecture-conformance progress.
