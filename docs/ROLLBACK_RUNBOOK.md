# COREVIA Rollback Runbook

## Purpose

This runbook defines how COREVIA returns to a stable production state after a failed release or severe post-deploy regression.

Use this runbook when the deployed release is not safely supportable and production must be stabilized quickly.

## Rollback Decision Triggers

Rollback is required when one or more of these conditions is true:

- `GET /api/health` or `GET /api/health/ready` remains failed or degraded beyond the agreed stabilization window
- sign in or session establishment is broken
- demand creation or demand workflow progression is broken
- knowledge upload is broken for valid files
- portfolio or admin visibility is broken for authorized users
- a migration introduces incompatible schema behavior
- error rate, latency, or queue backlog exceeds approved thresholds and does not recover with simple mitigation
- there is evidence of corruption, data loss risk, or privilege boundary failure

## Required Inputs

Before executing rollback, confirm:

- failing release version
- deployed git SHA and image digest
- last known good git SHA and image digest
- migrations included in the failing release
- latest verified backup or restore point timestamp
- incident commander
- rollback owner
- database owner

## First Actions

### 1. Declare And Contain

- announce rollback decision in the incident/release channel
- stop any ongoing change unrelated to stabilization
- preserve logs, error traces, and timestamps for later root-cause analysis

### 2. Decide Rollback Type

Choose one of the following paths:

- application rollback only
  Use when schema remains backward compatible and data integrity is not at risk.
- application rollback plus data restore
  Use when migrations are destructive, incompatible, or corruption risk exists.

If the correct path is unclear, assume the safer path and involve the database owner immediately.

## Path A: Application Rollback Only

Use this path when the old application version can safely run against the current schema.

### A1. Redeploy The Last Known Good Artifact

For Kubernetes environments:

```bash
kubectl -n corevia rollout undo deploy/<api-deployment-name>
kubectl -n corevia rollout status deploy/<api-deployment-name>
```

For Docker-controlled environments, redeploy the known-good image or compose revision using the canonical file:

```bash
docker compose --project-directory . -f infrastructure/docker/docker-compose.yml up -d api
```

### A2. Re-Run Baseline Verification

```bash
curl -fsS http://<host>/api/health
curl -fsS http://<host>/api/health/ready
curl -fsS http://<host>/metrics | head
```

Then verify the critical journey subset:

- sign in
- demand creation or demand retrieval
- demand workflow update
- knowledge upload
- one authorized admin page

### A3. Close The Incident Only After Stability Returns

Rollback is not complete until platform baseline and critical user journeys are stable again.

## Path B: Application Rollback Plus Data Restore

Use this path when schema or data state is not compatible with the previous release.

### B1. Stop Additional Writes

- pause release activity
- block or minimize business mutations if operationally possible
- capture timestamps and affected release details

### B2. Capture Forensic State

Before restore, retain evidence of the failure:

- failing release SHA and image digest
- migration output
- database error messages
- incident timeline

### B3. Restore The Database To The Last Verified Recovery Point

If managed backups are used, execute the provider restore workflow to the approved recovery point.

If direct PostgreSQL backup tooling is used, the canonical restore commands are:

```bash
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" <backup-file>
```

For logical backup validation before production use, the canonical backup command is:

```bash
pg_dump "$DATABASE_URL" --format=custom --file <backup-file>
```

If restore requires a fresh database target rather than in-place restore, use the provider-approved method and record the exact procedure.

### B4. Redeploy The Compatible Application Version

After data state is restored, redeploy the last known good artifact and wait for rollout completion.

### B5. Re-Validate Platform And Business Baseline

Validation must include:

- `GET /api/health`
- `GET /api/health/ready`
- `GET /metrics`
- sign in
- demand journey subset
- knowledge upload
- admin authorization check

## Rollback Evidence

Record the following after rollback:

- rollback trigger
- decision timestamp
- operators involved
- artifact version restored
- backup or restore point used
- data loss window, if any
- validation results after rollback
- follow-up corrective actions

## Exit Criteria

Rollback is complete only when:

- the system is back on a known-good artifact
- health and readiness are stable
- production-safe smoke checks pass
- incident owners agree the platform is supportable
- corrective action items are captured before the next release attempt
