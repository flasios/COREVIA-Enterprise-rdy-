# COREVIA Architecture Review

Date: 2026-03-10
Purpose: Provide a founder-level architecture review with current-state strengths, risks, gaps, and target-state decisions.
Scope: repository architecture, product architecture, operating-model alignment, and production-readiness implications.

## 1. Executive Verdict

COREVIA has the right architectural direction.

The system is already meaningfully differentiated because it combines:

- modular domain ownership,
- a governance-first decision pipeline,
- artifact versioning and approval flows,
- enterprise architecture and portfolio surfaces,
- and a clear sovereignty / compliance posture.

The architecture is not yet at target state, but it is strong enough to justify continued investment in the current model rather than a redesign.

My founder-level verdict is:

- target architecture concept: strong,
- strategic product architecture: strong,
- current implementation discipline: improving materially,
- runtime shape: still correct as a modular monolith,
- main risk: operating-model and structural rigor lag behind the platform ambition.

## 2. What Is Architecturally Right

## 2.1 The Right Strategic Core Exists

The strongest architectural move in COREVIA is the Brain plus Decision Spine model.

That is the correct center of gravity because it turns AI usage into a governed enterprise process rather than an uncontrolled assistant feature.

This is strategically better than:

- UI-first workflow products,
- isolated report generators,
- generic RAG copilots,
- or over-split microservices without a decision model.

## 2.2 Bounded-Context Thinking Is Real, Not Cosmetic

The repository has a genuine module structure across demand, portfolio, governance, knowledge, intelligence, EA, compliance, integration, identity, notifications, and operations.

This matters because it enables:

- ownership,
- boundary enforcement,
- safer refactors,
- and more credible enterprise-scale growth.

## 2.3 The Architecture Is Governance-First

The best enterprise systems are not just technically modular; they make control explicit.

COREVIA already does that through:

- approval workflows,
- versioning,
- HITL checkpoints,
- policy enforcement,
- classification constraints,
- and artifact lineage.

That is the correct architecture for government and institutional decision systems.

## 2.4 The Technology Choices Are Still Rational

The current stack remains appropriate:

- React + TypeScript + Vite on the client
- Express + TypeScript on the server
- PostgreSQL + Drizzle as primary system of record
- Redis for optional cache / queue patterns

There is no architecture-level reason to replace this stack right now.

## 3. Current Risks and Gaps

## 3.1 P1 Risk: Product Ambition Is Ahead of Structural Simplification

The platform surface is wide, but several critical UI areas remain too large and too dense.

Why this matters:

- high review friction,
- higher regression probability,
- slower onboarding,
- weaker testability,
- greater accidental coupling in user-facing flows.

Evidence already visible in the repo and associated docs:

- previously very large demand / PMO / execution / business-case / requirements tabs
- roadmap and audit documents explicitly identify mega-file decomposition as a major next step

Target-state implication:

- UI architecture must move from giant tab files to capability-owned subfeatures.

## 3.2 P1 Risk: Operating Model Is Under-Specified Relative to the Architecture

The code increasingly reflects bounded contexts, but the enterprise operating model is still not explicit enough.

Missing or incomplete architecture-management artifacts include:

- formal capability ownership matrix,
- target value-stream model,
- target information ownership model,
- architecture decision record cadence for major platform decisions,
- service extraction criteria agreed at executive level.

This is an enterprise architecture gap, not only an engineering gap.

## 3.3 P1 Risk: Read Models and Analytics Architecture Are Not Mature Enough Yet

The platform is naturally moving toward dashboards, PMO overviews, executive cockpits, governance views, and intelligence surfaces.

Those experiences should not depend indefinitely on page-local aggregation logic.

Target-state need:

- explicit read-model architecture,
- materialized and projection-based reporting surfaces where aggregation is heavy,
- domain-owned dashboard query services.

## 3.4 P1 Risk: AI Governance Is Strong Conceptually but Must Stay Ruthless in Execution

The existence of the 8-layer Brain is a strength.

The risk is not conceptual weakness. The risk is future discipline drift:

- bypassing governance for convenience,
- allowing direct generation paths to proliferate,
- learning from unapproved outputs,
- weakening provenance and policy checks under delivery pressure.

This would damage the entire product thesis.

## 3.5 P2 Risk: Runtime and Deployment Architecture Need Stronger Production Evidence

The repo shows strong intent around:

- charts,
- infra,
- K8s documentation,
- security posture,
- observability libraries,
- release-quality scripts.

But target-state enterprise confidence still depends on stronger operational evidence in practice:

- deployment proof,
- rollback evidence,
- backup and restore drills,
- SLOs and alerting artifacts,
- environment promotion discipline.

## 3.6 P2 Risk: Architecture Documentation Has Historically Drifted Behind Code

The codebase has moved faster than some of its earlier docs. That is common, but dangerous for enterprise programs.

If architecture docs lag:

- governance confidence falls,
- onboarding slows,
- auditors see contradiction,
- product and engineering decisions diverge.

## 4. Target-State Decisions

The following decisions should be treated as target-state architecture decisions, not optional ideas.

| ID | Decision | Status | Rationale |
| --- | --- | --- | --- |
| TD-01 | Keep modular monolith as the primary runtime shape for now | Decide now | The business model is still tightly coupled around one decision system; premature service splitting would increase risk |
| TD-02 | Preserve Brain + Decision Spine as the platform control plane | Decide now | This is COREVIA's strategic differentiator and governance anchor |
| TD-03 | Formalize capability ownership as an enterprise artifact | Decide now | Bounded-context code structure must match organizational ownership |
| TD-04 | Move critical UI surfaces to subfeature decomposition | Start now | This is the main structural scaling pressure in the current implementation |
| TD-05 | Introduce explicit query/read-model architecture for dashboards and executive views | Start next | Aggregation-heavy screens should not remain page-shaped forever |
| TD-06 | Use service extraction only when triggered by compliance, scale, or blast-radius evidence | Decide now | Avoid architecture theater |
| TD-07 | Treat approval-state synchronization as a governed canonical transition | Decide now | Prevent silent drift between reports, versions, and canonical records |
| TD-08 | Maintain sovereign-aware data classification and model routing rules as first-class policy | Decide now | This is non-negotiable for the target market |
| TD-09 | Institutionalize ADRs for all major platform decisions | Start now | Architecture has reached the maturity point where implicit decisions are too risky |
| TD-10 | Define a release evidence pack as part of architecture, not only DevOps | Start next | Enterprise trust depends on repeatable proof, not claims |

## 5. Architecture Review by Dimension

| Dimension | Review |
| --- | --- |
| Domain architecture | Strong direction with real bounded contexts |
| AI governance architecture | Strong and differentiating |
| Product architecture | Strong, but needs tighter value-stream definition |
| Data architecture | Good base, needs more explicit domain ownership and projection strategy |
| Security architecture | Good controls and posture, needs continued operational evidence |
| Deployment architecture | Reasonable direction, still needs harder evidence and drills |
| Frontend architecture | Functional and improving, but still structurally uneven in critical workspaces |
| Documentation architecture | Improving, but must become more systematic and executive-ready |

## 6. Immediate Gaps to Close

These are the gaps I would close next at architecture-program level.

1. Lock a formal target enterprise architecture baseline.
2. Lock a formal capability map and ownership model.
3. Define the target value streams across Demand, Governance, EA, Portfolio, and Knowledge.
4. Decompose the largest UI capability surfaces into subfeatures.
5. Introduce read models for dashboard and review-heavy domains.
6. Establish ADRs for service extraction, data ownership, and AI governance exceptions.
7. Build a release evidence pack standard that combines quality, security, architecture, and deployment proof.

## 7. Risks If COREVIA Does Not Act

If these architecture gaps are not closed, the most likely failure modes are:

- the codebase remains conceptually strong but slows down operationally,
- giant UI files keep creating avoidable regressions,
- governance semantics drift across modules,
- enterprise trust lags behind platform potential,
- service-splitting pressure appears before the product model is clean enough to support it.

That would be a leadership failure, not a technology failure.

## 8. Recommended Transformation Sequence

### Wave 1

- target architecture baseline
- capability ownership baseline
- ADR discipline
- high-risk UI decomposition

### Wave 2

- read-model architecture
- dashboard / cockpit projection strategy
- enterprise information ownership model
- release evidence pack standard

### Wave 3

- selective service extraction where justified
- stronger sovereign deployment packaging
- operational SLO / disaster recovery maturity
- institutional learning loop formalization

## 9. Final Founder-Level Judgment

COREVIA should continue on its current fundamental architecture path.

The platform does not need a reset. It needs disciplined convergence.

The real job now is to convert a strong architectural idea into a fully governed enterprise operating system by tightening structure, ownership, evidence, and decision discipline around what is already a differentiated core.