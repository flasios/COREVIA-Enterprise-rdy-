# COREVIA Launch Readiness Checklist

## Purpose

This checklist is the Phase 2 go/no-go control sheet for COREVIA.

It converts the launch plan into an operator-facing gate covering security, observability, recovery, release discipline, and hypercare ownership.

Status values:

- `Ready`
- `Blocked`
- `Waived`

Any waived item must name the approving owner and compensating control.

## 1. Security Baseline

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| Production `SESSION_SECRET` is set and meets strength requirements |  |  |
| `ALLOWED_ORIGINS` is restricted to approved production origins |  |  |
| `TRUST_PROXY=true` is configured behind ingress/load balancer |  |  |
| CSRF, auth-origin, and secure session defaults are active in production config |  |  |
| Self-registration is disabled in production |  |  |
| Upload malware scanning mode is enforced for production |  |  |
| Privileged mutation paths are rate-limited and audited |  |  |
| `npm run security:audit` is green or approved with explicit waiver |  |  |
| UAE residency and provider compliance assumptions are documented |  |  |

Reference documents:

- `docs/SECURITY_BEST_PRACTICES.md`
- `docs/PRODUCTION_ENFORCEMENT_ROLLOUT.md`
- `docs/uae-government-deployment-checklist.md`

## 2. Observability And Supportability

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| `/api/health` is monitored |  |  |
| `/api/health/ready` is monitored |  |  |
| `/metrics` is reachable and scraped |  |  |
| request/correlation identifiers are visible in logs |  |  |
| central log destination is defined |  |  |
| alert thresholds exist for availability, error rate, latency, and queue/worker degradation |  |  |
| on-call owner is named for launch and hypercare |  |  |

## 3. Data Protection And Recovery

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| clean-environment migration path is verified |  |  |
| backup procedure is documented and owned |  |  |
| restore procedure is documented and rehearsed |  |  |
| latest restore drill date is recorded |  |  |
| acceptable recovery point and recovery time are agreed |  |  |
| uploaded evidence retention handling is documented |  |  |

Reference document:

- `docs/ROLLBACK_RUNBOOK.md`

## 4. Release Engineering And Environments

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| release candidate passed `npm run quality:release` |  |  |
| OpenAPI artifact regenerated with `npm run docs:api` |  |  |
| staging runs the exact production candidate |  |  |
| staging smoke gate passed |  |  |
| last known good artifact is recorded |  |  |
| rollback owner and rollback path are confirmed |  |  |
| production sign-off template is completed |  |  |

Reference documents:

- `docs/RELEASE_RUNBOOK.md`
- `docs/STAGING_SMOKE_GATE.md`
- `docs/uae-evidence-pack/signoff-template.md`

## 5. Business-Critical Journeys

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| sign in and session validation passed |  |  |
| demand creation passed |  |  |
| demand workflow progression passed |  |  |
| knowledge upload passed |  |  |
| portfolio visibility passed |  |  |
| admin access control passed |  |  |

Reference document:

- `docs/STAGING_SMOKE_GATE.md`

## 6. Launch Governance And Hypercare

| Item | Status | Evidence / Notes |
| --- | --- | --- |
| release commander is named |  |  |
| incident/rollback channel is active |  |  |
| product owner sign-off is recorded |  |  |
| security owner sign-off is recorded |  |  |
| operations owner sign-off is recorded |  |  |
| compliance/GRC sign-off is recorded where required |  |  |
| hypercare owners and review cadence are named for 7 to 14 days post go-live |  |  |

## Go / No-Go Rule

Production go-live is allowed only when:

- no launch-blocking item remains `Blocked`
- each `Waived` item has a named approver and compensating control
- release sign-off is complete
- rollback readiness is confirmed
