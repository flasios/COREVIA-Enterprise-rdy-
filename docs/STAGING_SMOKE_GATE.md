# COREVIA Staging Smoke Gate

## Purpose

This document defines the minimum business-critical validation suite that must pass on staging before a release is approved for production.

The artifact validated in staging must be the exact artifact promoted to production.

## Entry Criteria

Do not start this smoke gate unless:

- the candidate build passed `npm run quality:release`
- the candidate passed `npm run test:business-case:contract`
- the candidate OpenAPI artifact was regenerated with `npm run docs:api`
- staging is running the exact release candidate
- staging data and test identities are available
- the release window owner and rollback owner are identified

## Platform Baseline

Run these checks first:

```bash
curl -fsS http://<staging-host>/api/health
curl -fsS http://<staging-host>/api/health/ready
curl -fsS http://<staging-host>/metrics | head
```

Expected result:

- health responds successfully
- readiness responds successfully
- metrics output contains Prometheus data such as `http_requests_total`
- logs show correlation/request identifiers for traced requests

If platform baseline fails, stop. Do not continue business smoke tests.

## Business-Critical Journey Gate

All items below are release-blocking.

### 1. Sign In And Session Integrity

Validate:

- login page loads
- valid credentials can sign in
- invalid credentials are rejected
- authenticated session can call `/api/auth/me`
- CSRF token endpoint `/api/auth/csrf-token` is available for same-origin authenticated mutation flow

Evidence:

- response captures or Playwright result
- timestamp and operator name

### 2. Demand Creation

Validate:

- a new demand can be created through the UI or `POST /api/demand-reports`
- created demand returns `201`
- newly created demand can be retrieved by ID

Suggested evidence:

- demand ID
- request timestamp
- screenshot of created record or API response excerpt

### 3. Demand Workflow Progression

Validate:

- workflow can move the created demand to `acknowledged`
- `PUT /api/demand-reports/{id}/workflow` succeeds
- resulting demand detail shows the updated workflow state

### 4. Demand Analysis Reachability

Validate at least one AI-assisted demand route:

- `POST /api/demand-analysis/generate-fields`, or
- `POST /api/demand-analysis/classify`

Expected result:

- the request succeeds or returns the expected controlled fallback behavior
- no unhandled server error appears in logs

### 5. Knowledge Upload

Validate one standard knowledge upload path:

- upload a valid document through the UI or `POST /api/knowledge/upload`
- confirm upload is accepted and stored under normal access control
- verify invalid file types remain rejected

If chunked upload is part of the release scope, also validate:

- `/api/knowledge/upload/chunked/init`
- `/api/knowledge/upload/chunked/{uploadId}/chunk`
- `/api/knowledge/upload/chunked/{uploadId}/complete`

### 6. Business Case Generation Contract

Validate at least one business case from each active archetype family in scope for the release:

- government / digital service archetype
- autonomous mobility archetype
- healthcare or regulated vertical archetype

For each validated business case confirm:

- `GET /api/demand-reports/{id}/business-case` succeeds
- `computedFinancialModel` is present
- scenarios include `pessimistic`, `base`, and `optimistic`
- operational intelligence includes revenue segmentation, kill-switch metrics, and risk-adjusted NPV
- no section renders as empty, placeholder-only, or structurally missing in the UI

If the release introduces a new archetype or archetype mapping, include at least one staging sample for that archetype before production approval.

### 7. Portfolio Visibility

Validate at least one authorized portfolio surface:

- `/portfolio-hub`, or
- `/intelligent-portfolio`

Expected result:

- page renders for an authorized user
- backing portfolio queries return successfully
- no authorization or data-loading failure is visible

### 8. Admin Access Control

Validate:

- authorized admin can access `/admin/users`
- authorized admin can access `/admin/teams`
- non-admin access remains denied or redirected appropriately

### 9. EA Registry Reachability

Validate:

- authenticated user can open `/ea-registry/applications`
- initial page data and register action are visible

## Pass / Fail Rule

The smoke gate passes only when:

- all platform baseline checks pass
- all release-blocking journeys pass
- no unexplained `5xx` spike appears in logs
- no unresolved severity-high defect is introduced by the candidate

Any failure is a release stop until corrected and revalidated.

## Recommended Execution Paths

Where automation is available, prefer:

```bash
npm run test:e2e:enterprise
```

If manual execution is required, capture evidence for each gate item in the release evidence pack.
