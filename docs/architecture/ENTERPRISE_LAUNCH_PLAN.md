# COREVIA Enterprise Launch Plan

Date: 2026-03-11
Status: active working plan
Target outcome: launch a professional, enterprise-ready modular monolith with controlled production risk

## Executive Position

COREVIA should launch as:

- a modular monolith,
- in a monorepo-style repository structure,
- with enterprise-grade operational controls,
- without pretending to be a microservices platform before the operating model justifies it.

The objective is not to make the repository look sophisticated.

The objective is to make the system launchable, supportable, secure, observable, and governable.

## Current Truth

What is already strong:

- canonical repository roots are now visible and professional,
- `apps/api` is the active backend shell,
- `apps/web` is the active frontend root,
- Docker is consolidated under `infrastructure/docker/`,
- the runtime model is honestly monolith-first,
- architecture boundaries are materially stronger than before.

What is not complete yet:

- API contract/documentation closeout,
- full `apps/api` transport ownership closeout,
- seam tests around the new API shell,
- dependency/security cleanup,
- launch operations discipline across observability, release readiness, rollback, and hypercare.

## Launch Principle

Launch quality will come from four things being true at the same time:

1. the architecture is coherent,
2. the operational controls are real,
3. the release process is repeatable,
4. the team can detect and recover from failure quickly.

## Program Structure

The launch program is split into four phases.

### Phase 1: Architecture Closeout

Purpose:

- finish the current modular-monolith/API-shell transition so the system has a stable shape before launch hardening begins.

Scope:

- complete OpenAPI coverage for active transport surfaces,
- regenerate and validate `docs/openapi.json`,
- finish `apps/api` transport ownership for remaining identity/platform seams,
- add seam tests around bootstrap and route composition,
- remove current dependency/security debt that blocks launch confidence.

Definition of done:

- the active transport surface is documented,
- `apps/api` is the clear HTTP composition owner,
- shell seams have regression coverage,
- known blocking dependency issues are closed or explicitly waived.

Evidence:

- clean `npm run build:server`,
- successful OpenAPI generation,
- passing seam tests,
- updated closeout docs.

### Phase 2: Launch Readiness Hardening

Purpose:

- make the current system operationally enterprise-ready without changing the core runtime model.

Scope:

- security baseline review,
- production configuration validation,
- observability and health completeness,
- backup/restore verification,
- deployment checklist completion,
- CI/CD release discipline,
- smoke-test definition for critical user journeys.

Work packages:

#### 2.1 Security And Compliance Hardening

- enforce production secrets and config review,
- validate session, CORS, proxy, CSP, upload, and evidence-control settings,
- verify UAE data residency and provider compliance assumptions,
- close medium-or-higher dependency issues,
- confirm privileged mutation paths are rate-limited and audited.

Definition of done:

- no known unresolved launch-blocking security gap remains,
- production security settings are documented and validated.

#### 2.2 Observability And Supportability

- confirm `/health` and readiness coverage,
- confirm correlation/request IDs flow through logs,
- define structured log export target,
- define launch dashboards for availability, latency, error rate, queue depth, and AI/provider failure,
- define alert thresholds and on-call ownership.

Definition of done:

- the team can detect production failure within minutes and identify the failing layer quickly.

#### 2.3 Data Protection And Recovery

- verify migration path on a clean environment,
- verify backup procedure,
- verify restore procedure and restore timing,
- verify retention handling for uploaded evidence and generated artifacts.

Definition of done:

- backup and restore are proven, not assumed.

#### 2.4 Release Engineering And Environments

- define staging as the final pre-production proving ground,
- require green build, smoke tests, and image build before release approval,
- define release artifact versioning,
- define rollback procedure,
- define go/no-go decision process.

Definition of done:

- production release becomes a controlled procedure, not a manual improvisation.

#### 2.5 Business-Critical Journey Validation

- identify top launch journeys:
  - sign in,
  - demand creation,
  - demand workflow progression,
  - knowledge upload,
  - portfolio visibility,
  - admin access control,
- create smoke tests for those journeys,
- define acceptance thresholds for launch.

Definition of done:

- the most important business flows have explicit launch validation coverage.

Phase 2 exit gate:

- security baseline accepted,
- observability baseline accepted,
- backup/restore proven,
- release procedure documented,
- critical smoke suite defined and passing in staging.

Operational assets created for Phase 2 execution:

- `docs/LAUNCH_READINESS_CHECKLIST.md`
- `docs/RELEASE_RUNBOOK.md`
- `docs/ROLLBACK_RUNBOOK.md`
- `docs/STAGING_SMOKE_GATE.md`
- `docs/uae-evidence-pack/signoff-template.md`

### Phase 3: Production Launch Execution

Purpose:

- execute launch with discipline and minimal operational ambiguity.

Scope:

- final staging dress rehearsal,
- launch readiness review,
- production cutover,
- controlled validation window,
- hypercare.

Execution sequence:

#### 3.1 Dress Rehearsal

- deploy the exact candidate to staging,
- run migrations,
- run smoke suite,
- validate dashboards, logs, and alerts,
- test rollback path.

#### 3.2 Go-Live Gate

Launch approval requires explicit sign-off on:

- architecture closeout,
- security baseline,
- observability baseline,
- restore capability,
- smoke results,
- rollback readiness.

#### 3.3 Production Cutover

- deploy a single approved release artifact,
- run migrations in the approved sequence,
- verify health, readiness, and core journeys,
- monitor errors and latency in real time.

#### 3.4 Hypercare

- 7 to 14 days of intensified monitoring,
- daily review of incidents, performance, and user friction,
- freeze non-essential change during the stabilization window.

Definition of done:

- the system is live, stable, supportable, and not dependent on heroic manual intervention.

### Phase 4: Post-Launch Expansion

Purpose:

- evolve the platform after stability is established, without contaminating launch discipline.

Allowed themes:

- worker runtime separation,
- AI runtime separation,
- web runtime separation,
- deeper observability stack,
- advanced enterprise features such as feature flags, API versioning, broader i18n, and progressive runtime decomposition.

Rule:

- no speculative new runtime should be introduced before post-launch evidence justifies it.

## Working Sequence

The required sequence is:

1. finish Phase 1 architecture closeout,
2. complete Phase 2 launch hardening,
3. execute Phase 3 launch,
4. only then begin Phase 4 expansion.

## Launch Gates

The system should not be called enterprise-grade for launch until all of the following are true:

- architecture ownership is clear,
- active APIs are documented,
- seam regressions are covered,
- medium-or-higher dependency risk is acceptable,
- staging release path is repeatable,
- rollback is documented and rehearsed,
- observability is sufficient for incident response,
- backup/restore is proven,
- critical user journeys pass in staging and at launch.

## Deliverables By Phase

### Phase 1 Deliverables

- updated `interfaces/config/swagger.ts`
- regenerated `docs/openapi.json`
- completed `apps/api` transport seams
- seam test coverage for API shell
- dependency remediation evidence

### Phase 2 Deliverables

- validated deployment checklist
- launch smoke suite
- release runbook
- rollback runbook
- monitoring/dashboard checklist
- backup/restore evidence

### Phase 3 Deliverables

- signed launch gate review
- launch execution log
- hypercare ownership plan

### Phase 4 Deliverables

- justified runtime split proposals and only then the corresponding implementation work

## Immediate Next Actions

1. complete Phase 1 closeout from `API_SHELL_CLOSEOUT_TASKS.md`
2. create a launch-readiness checklist derived from Phase 2 and tie it to staging validation
3. define the go-live gate and hypercare ownership model before any production cutover

## Related References

- [API_SHELL_CLOSEOUT_TASKS.md](API_SHELL_CLOSEOUT_TASKS.md)
- [deployment.md](deployment.md)
- [../DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md)
- [../PRODUCTION_ENFORCEMENT_ROLLOUT.md](../PRODUCTION_ENFORCEMENT_ROLLOUT.md)
- [../SECURITY_BEST_PRACTICES.md](../SECURITY_BEST_PRACTICES.md)