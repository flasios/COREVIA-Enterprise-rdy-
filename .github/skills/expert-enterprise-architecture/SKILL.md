---
name: expert-enterprise-architecture
description: 'Expert enterprise architecture workflow for COREVIA focused on architecture conformance, implementation-backed gap analysis, remediation planning, domain boundary review, deployment-topology validation, and evidence-based modernization plans. Use when reviewing target-state alignment or turning architecture findings into concrete execution steps.'
argument-hint: 'What architecture outcome do you need, for example current-state review, target architecture, capability map, or execution plan?'
user-invocable: true
---

# Expert Enterprise Architecture

Use this skill to produce rigorous enterprise architecture outputs for COREVIA, with emphasis on conformance assessment, implementation drift detection, and technically actionable remediation plans.

## When to Use
- Review platform, domain, application, or deployment architecture for conformance.
- Create a target-state architecture from current implementation and docs.
- Assess alignment between code structure, runtime topology, and documented architecture.
- Produce executive architecture summaries, implementation roadmaps, or readiness reviews.
- Evaluate whether a proposed change respects domain boundaries, ownership, integration contracts, and operational controls.
- Turn architecture findings into a sequenced remediation plan that engineering teams can execute.

## Default Operating Pattern
1. Define the architecture question precisely.
2. Gather canonical evidence from the repo before making claims.
3. Separate current state, target state, and remediation recommendation.
4. Prefer structural root-cause findings over surface-level symptoms.
5. Validate recommendations against runtime, deployment, security, and governance realities.
6. End with explicit decisions, risks, owners, and next execution steps.

## Inputs To Collect
- Requested outcome: review, target architecture, roadmap, governance model, capability map, or conformance check.
- Scope: enterprise, platform, application, domain, integration, data, security, or deployment.
- Constraints: delivery timeline, environments, compliance, team boundaries, cost, and legacy dependencies.
- Evidence sources: code, ADRs, architecture docs, deployment manifests, API contracts, and operational runbooks.

## Procedure

### 1. Frame the Decision
- Restate the exact architecture outcome to produce.
- Identify the level of abstraction required: executive, solution, platform, or implementation.
- Determine whether the user needs analysis only or concrete file changes as well.

### 2. Establish Canonical Sources
- Read the most authoritative architecture material first.
- Prefer current implementation evidence when documentation and code disagree.
- Use repo artifacts such as:
  - `docs/ARCHITECTURE.md`
  - `docs/COREVIA_TARGET_ENTERPRISE_ARCHITECTURE_2026-03-10.md`
  - `docs/COREVIA_ARCHITECTURE_REVIEW_2026-03-10.md`
  - `docs/COREVIA_CAPABILITY_MAP_2026-03-10.md`
  - `docs/COREVIA_ARCHITECTURE_CONFORMANCE_CHECKLIST_2026-03-10.md`
  - `docs/COREVIA_ARCHITECTURE_CONFORMANCE_EXECUTION_PLAN_2026-03-10.md`
  - `docs/ENTERPRISE_ARCHITECTURE_GOVERNMENT.md`
  - `docs/SOURCE_STRUCTURE_TARGET.md`
  - `infrastructure/docker/docker-compose.yml`
  - relevant code under `domains/`, `platform/`, `apps/`, `server/`, `interfaces/`, and `packages/`

### 3. Build the Current-State View
- Identify bounded contexts, domain ownership, shared platform capabilities, and integration seams.
- Trace runtime topology, deployment units, infrastructure dependencies, and data flows.
- Note places where the codebase still reflects transitional or legacy structure.
- Distinguish verified facts from assumptions.

### 4. Compare Against the Intended Architecture
- Map current implementation to the documented target structure.
- Identify gaps in module boundaries, public interfaces, deployment topology, security controls, observability, operational ownership, and repo structure.
- Classify each gap as one of:
  - documentation drift
  - implementation drift
  - governance/process weakness
  - missing platform capability
  - deployment or runtime inconsistency

### 5. Decide the Recommendation Path
- If the issue is documentation drift, update docs or explicitly mark the implementation as canonical.
- If the issue is implementation drift, recommend the smallest change set that restores architectural integrity and identify the concrete files or layers affected.
- If the issue is systemic, propose phased remediation with sequencing, dependencies, and risk controls.
- If the architecture is already sound, state that clearly and focus on residual risks and missing evidence.

### 6. Produce the Deliverable
Adapt the output format to the ask.

For a review:
- Findings ordered by severity.
- Evidence for each finding.
- Risk if unchanged.
- Recommended action.
- Concrete remediation path with affected layers, entrypoints, or deployment assets.

For a target architecture:
- Architecture principles.
- Capability map.
- logical/component view.
- deployment/runtime view.
- integration and data boundaries.
- governance and ownership model.

For an execution plan:
- workstreams.
- dependencies.
- milestones.
- acceptance gates.
- rollback or risk mitigation strategy.

For conformance remediation:
- current-state deviation.
- target-state rule or principle being violated.
- affected files, modules, runtimes, or interfaces.
- smallest viable remediation.
- validation steps.
- follow-on cleanup if debt remains.

### 7. Validate Before Closing
- Check that recommendations are compatible with actual build, runtime, and deployment mechanisms.
- Verify that proposed boundaries match repository structure and public entrypoints.
- Confirm that security, compliance, observability, and operability are not treated as afterthoughts.
- Call out open questions where evidence is incomplete.
- Prefer recommendations that can be verified by code changes, tests, or smoke checks.

## Decision Points
- Code or docs as source of truth:
  Prefer code for current state, docs for intent, and explicitly resolve disagreements.
- Incremental remediation or redesign:
  Prefer incremental remediation unless the current structure cannot support target operating constraints.
- Domain split or shared platform:
  Split only when ownership, scaling, compliance, or deployment independence requires it.
- New runtime or reuse existing unit:
  Add a deployable runtime only when it represents a real operational boundary, not a conceptual one.

## Quality Criteria
- Every material claim is tied to evidence from the repo.
- Current state and target state are not mixed together.
- Recommendations are technically implementable in this codebase.
- Domain boundaries, integration contracts, and ownership lines are explicit.
- Risks, assumptions, and missing evidence are surfaced clearly.
- Outputs are useful to both engineering leadership and implementers.
- Remediation steps are specific enough to assign and verify.

## Completion Checks
- The architecture question was answered directly.
- The deliverable includes findings or decisions, not just description.
- The response identifies what is verified versus assumed.
- The next actions are sequenced and realistic.
- If code changes were requested, implementation and verification are complete.
- Conformance findings identify the affected architecture layer and proposed fix path.

## Example Prompts
- `/expert-enterprise-architecture Review the current COREVIA architecture against the target enterprise architecture and identify the top five implementation gaps.`
- `/expert-enterprise-architecture Create a target-state capability map for COREVIA using the existing docs and repo structure.`
- `/expert-enterprise-architecture Assess whether the current Docker and deployment topology matches the documented architecture.`
- `/expert-enterprise-architecture Produce a phased architecture execution plan for moving legacy server paths to canonical domain and platform entrypoints.`