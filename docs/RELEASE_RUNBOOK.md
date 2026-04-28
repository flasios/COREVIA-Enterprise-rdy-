# COREVIA Release Runbook

## Purpose

This runbook defines the controlled release procedure for COREVIA production deployments.

It is the Phase 2 execution document for:

- release approval,
- deployment execution,
- post-deploy validation,
- evidence collection,
- hypercare handoff.

Use this runbook together with:

- `docs/LAUNCH_READINESS_CHECKLIST.md`
- `docs/STAGING_SMOKE_GATE.md`
- `docs/ROLLBACK_RUNBOOK.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/uae-evidence-pack/signoff-template.md`

## Required Inputs

Capture these values before the change window opens:

- release version
- git commit SHA
- deployment environment
- image tag and image digest
- migration set included in the release
- approved change window
- release commander
- rollback owner
- database owner/on-call

## Exit Criteria For Starting A Release

Do not start production deployment until all of the following are true:

- architecture closeout is accepted for the candidate release
- `docs/LAUNCH_READINESS_CHECKLIST.md` is fully green or has explicit waivers
- `docs/uae-evidence-pack/evidence-register.csv` is updated for the release
- `docs/uae-evidence-pack/signoff-template.md` is completed for the release candidate
- last known good artifact is identified and available for rollback
- backup snapshot or managed backup restore point is verified
- staging has already run the exact candidate artifact
- on-call and stakeholder communication channel are active

## Pre-Release Quality Gates

Run these commands from the repository root against the release candidate:

```bash
npm ci
npm run quality:release
npm run docs:api
```

If enterprise browser coverage is required for the release window, also run:

```bash
npm run test:e2e:enterprise
```

Record the outcomes in the release evidence pack.

## Staging Dress Rehearsal

Before production, deploy the exact same candidate to staging and complete the smoke gate in `docs/STAGING_SMOKE_GATE.md`.

Minimum staging verification:

- `GET /api/health` returns success
- `GET /api/health/ready` returns success
- `GET /metrics` responds in Prometheus format
- critical user journeys pass
- no unexplained spike appears in error logs or latency

If staging fails, stop. Do not promote the artifact.

## Production Release Procedure

### 1. Open The Change Window

- announce release start in the approved operations channel
- confirm release commander, rollback owner, and database owner are present
- freeze unrelated production changes until validation is complete

### 2. Confirm Recovery Position

- confirm the last known good image digest
- confirm the last verified backup or restore point timestamp
- confirm any database migrations in this release are reversible or explicitly approved as non-reversible

If recovery position is unclear, stop.

### 3. Deploy The Approved Artifact

Use the environment-specific deployment path.

For Kubernetes-based production, apply the approved manifest or image update and then wait for rollout completion:

```bash
kubectl -n corevia rollout status deploy/<api-deployment-name>
```

For Docker-based controlled environments, use the canonical compose file:

```bash
docker compose --project-directory . -f infrastructure/docker/docker-compose.yml up -d api
```

Do not substitute a new build during the change window. Deploy the already-approved artifact only.

### 4. Run Migrations In The Approved Sequence

If the release contains schema changes, run the approved migration procedure once:

```bash
npm run db:migrate
```

If production uses a different migration runner, record the exact command and output in the release evidence pack.

### 5. Verify Platform Baseline Immediately

Run the first-line checks:

```bash
curl -fsS http://<host>/api/health
curl -fsS http://<host>/api/health/ready
curl -fsS http://<host>/metrics | head
```

Confirm:

- health is up
- readiness is up
- metrics endpoint responds
- logs contain request/correlation identifiers

### 6. Execute The Production Smoke Subset

Run the production-safe subset from `docs/STAGING_SMOKE_GATE.md`:

- sign in
- demand creation
- demand workflow progression
- knowledge upload
- portfolio visibility
- admin access control

Any failed critical journey is a stop signal.

### 7. Collect Release Evidence

Attach or reference the following in the evidence pack:

- quality gate outputs
- deployment manifest or release command reference
- migration output
- health and readiness results
- smoke results
- open issues and waivers
- approver names and timestamps

### 8. Enter Hypercare

For the first 7 to 14 days after go-live:

- review incidents and error rate daily
- review performance and queue behavior daily
- freeze non-essential production change
- escalate any rollback-class issue through the rollback runbook immediately

## Stop And Rollback Conditions

Trigger `docs/ROLLBACK_RUNBOOK.md` if any of the following occurs after deployment:

- health or readiness does not recover within the agreed stabilization window
- login or authenticated session flow is broken
- demand creation or workflow progression fails
- knowledge upload fails for valid files
- privileged admin surfaces are inaccessible or authorization is broken
- migration causes data integrity risk or unexpected schema incompatibility
- production error rate or latency rises outside the approved threshold and does not normalize quickly

## Release Completion Criteria

A release is complete only when:

- deployment finished successfully
- production smoke subset passed
- evidence pack is updated
- go-live decision is recorded
- hypercare owner is named and active
