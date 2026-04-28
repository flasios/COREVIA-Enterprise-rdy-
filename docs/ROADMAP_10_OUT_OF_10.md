# COREVIA — Roadmap to 10/10

> **Current Score: 7.2/10** → **Target: 10/10**
>
> 6 phases. 48 work packages. Estimated: 14–18 weeks with 2 senior engineers.
>
> Each item is tagged with the dimension it moves and the score delta.

---

## Phase 0 — Foundation & Quick Wins (Week 1–2)

> **Goal:** Fix broken infrastructure, wire unused code, establish baselines.

### 0.1 Fix Broken Docker Compose  *(DevOps 7→7.5)*

| # | Task | Detail |
|---|------|--------|
| 0.1.1 | Create canonical API Dockerfile | Place the active application image at `infrastructure/docker/api.Dockerfile` |
| 0.1.2 | Create canonical Docker stack file | Keep the active monolith stack at `infrastructure/docker/docker-compose.yml` |
| 0.1.3 | Validate monolith stack boots | `docker compose -f infrastructure/docker/docker-compose.yml up --build` → api, Postgres, and Redis healthy |
| 0.1.4 | Remove hardcoded Postgres creds from compose | Use `.env` references; add `.env.docker.example` |

### 0.2 Wire Unused Rate Limiters  *(Security 8→8.5)*

| # | Task | Detail |
|---|------|--------|
| 0.2.1 | Apply `aiLimiter` to all AI/Brain routes | `/api/brain/*`, `/api/intelligence/*`, `/api/ea/generate` |
| 0.2.2 | Apply `uploadLimiter` to file upload routes | `/api/knowledge/documents/upload`, `/api/evidence/*` |
| 0.2.3 | Apply `strictLimiter` to admin mutation routes | User management, role changes, permission overrides |

### 0.3 Fix Swagger API Scan Path  *(Documentation 7→7.5)*

| # | Task | Detail |
|---|------|--------|
| 0.3.1 | Update `swagger.ts` scan path | Change `./server/routes/**/*.ts` → `['./server/routes/**/*.ts', './server/modules/*/api/**/*.ts']` |
| 0.3.2 | Add JSDoc `@openapi` annotations to top 20 route handlers | Prioritize: auth, demands, portfolio, EA, knowledge |

### 0.4 Add Missing npm Scripts  *(Code Quality 8→8.5)*

| # | Task | Detail |
|---|------|--------|
| 0.4.1 | Add `"test": "vitest run"` script | Umbrella command that runs all tests |
| 0.4.2 | Add `"test:watch": "vitest"` script | Dev-mode watcher |
| 0.4.3 | Add `"test:coverage": "vitest run --coverage"` | With `@vitest/coverage-v8` provider |
| 0.4.4 | Add `"format": "prettier --write ."` | Install Prettier, add `.prettierrc` |
| 0.4.5 | Add `"db:generate": "drizzle-kit generate"` | Generate migration SQL from schema diff |
| 0.4.6 | Add `"db:migrate": "drizzle-kit migrate"` | Apply pending migrations (tracked, not push) |
| 0.4.7 | Add `"db:seed": "tsx scripts/seed.ts"` | Seed script for dev/test environments |

---

## Phase 1 — Testing (Week 2–6)

> **Goal:** Raise test coverage from 1.9% to 30%+. This is the single most impactful phase.
>
> **Score impact:** Testing 3→8, Frontend 6→7

### 1.1 Server Domain Test Completion  *(Testing 3→5)*

| # | Task | Detail |
|---|------|--------|
| 1.1.1 | Add `useCases.test.ts` to 4 modules missing them | `platform`, `intelligence`, `notifications`, `integration` — each currently has `domain.test.ts` only |
| 1.1.2 | Add `api.routes.test.ts` to all 12 modules | Use `supertest` against express app with mocked storage ports; cover CRUD + auth + validation |
| 1.1.3 | Add Brain pipeline unit tests | Per-layer tests for all 8 layers: intake, classification, policyops, context, orchestration, reasoning, validation, memory |
| 1.1.4 | Add Spine Orchestrator state machine tests | Test all state transitions, invalid transitions rejected, sub-decision lifecycle |
| 1.1.5 | Add storage repository tests | Test 6 critical repositories against a real Postgres (testcontainers or in-memory PG) |
| 1.1.6 | Set coverage threshold in vitest config | `coverage: { provider: 'v8', thresholds: { lines: 30, branches: 25, functions: 30, statements: 30 } }` |

### 1.2 Frontend Testing Setup  *(Testing 5→6, Frontend 6→7)*

| # | Task | Detail |
|---|------|--------|
| 1.2.1 | Create `vitest.client.config.ts` | Environment: `jsdom`, setup file for `@testing-library/react`, alias `@client` |
| 1.2.2 | Add `@testing-library/react` + `@testing-library/user-event` | Already `@testing-library/jest-dom` installed; wire properly for vitest |
| 1.2.3 | Add `msw` (Mock Service Worker) for API mocking | Centralized mock handlers matching `/api/*` routes |
| 1.2.4 | Test 10 critical UI components | `LoginForm`, `DemandWizard`, `WorkflowApproval`, `VersionSelector`, `PermissionGate`, `EARegistryTable`, `StrategicFitTab`, `BusinessCaseTab`, `DashboardCharts`, `NavigationLayout` |
| 1.2.5 | Test 5 critical hooks | `useAuth`, `usePermissions`, `useDemandVersions`, `useEAData`, `useProjectWorkspace` |
| 1.2.6 | Add `"test:client": "vitest run -c vitest.client.config.ts"` script | Wire into `quality:gate` |

### 1.3 E2E Testing Setup  *(Testing 6→8)*

| # | Task | Detail |
|---|------|--------|
| 1.3.1 | Install + configure Playwright | `npx playwright init`, browsers: chromium only for CI speed |
| 1.3.2 | Create E2E test fixtures | Login helper, DB seed/teardown, API fixtures for demands/projects |
| 1.3.3 | Write 10 critical-path E2E tests | (1) Login/logout, (2) Create demand, (3) Demand analysis workflow (submit→review→approve→publish), (4) EA generation + approval, (5) Strategic Fit unlocking, (6) Project workspace phases, (7) Knowledge document upload + search, (8) Portfolio dashboard, (9) RBAC permission denied flows, (10) Admin user management |
| 1.3.4 | Add `"test:e2e": "playwright test"` script | Separate from unit suite; CI runs in Docker |
| 1.3.5 | Add Playwright CI job to `security-gate.yml` | Or create separate `ci.yml` workflow |

### 1.4 Contract / API Testing  *(Testing 8→9)*

| # | Task | Detail |
|---|------|--------|
| 1.4.1 | Add Zod contract validation tests | For each `shared/contracts/*.ts`, verify server responses match contract schemas |
| 1.4.2 | Add Swagger-to-test validation | `swagger-jsdoc-validator` or custom script asserting all annotated routes match actual Express routes |
| 1.4.3 | Add migration forward-compatibility tests | Each migration runs without errors on a clean DB; schema after all migrations matches `db:push` output |

---

## Phase 2 — Architecture Refinement (Week 5–8)

> **Goal:** Eliminate the God Interface, mature frontend architecture, add CQRS where it matters.
>
> **Score impact:** Domain Modeling 8→9.5, Frontend 7→9, Architecture 9→10

### 2.1 Decompose IStorage God Interface  *(Domain Modeling 8→9.5)*

| # | Task | Detail |
|---|------|--------|
| 2.1.1 | Refactor module route registration to accept narrow ports | Change `registerDemandRoutes(app, storage: IStorage)` → `registerDemandRoutes(app, storage: IDemandStoragePort & IVersioningStoragePort)` — each module declares only the ports it needs |
| 2.1.2 | Update composition root to inject narrowed types | `server/routes/registerDomainRoutes.ts` passes `storage as IDemandStoragePort & IVersioningStoragePort` |
| 2.1.3 | Add port boundary lint rule | Architecture boundary check script: modules must not import `IStorage` directly — only their declared ports |
| 2.1.4 | Wire `TenantAwareStorage` into `PostgresStorage` | Make `PostgresStorage extends TenantAwareStorage`, apply tenant filters in multi-tenant queries |
| 2.1.5 | Extract `LearningStoragePort` | Move learning methods out of `IIntelligenceStoragePort` into dedicated `ILearningStoragePort` with own repository |

### 2.2 Frontend Component Decomposition  *(Frontend 7→8.5)*

**Rule: No component file exceeds 800 lines.**

| # | Task | Detail |
|---|------|--------|
| 2.2.1 | Decompose `ExecutionPhaseTab.tsx` (8,650 lines) | Split into: `ExecutionOverview`, `ExecutionDeliverables`, `ExecutionTimeline`, `ExecutionCosts`, `ExecutionRisks`, `ExecutionQuality`, `ExecutionTeam` — each max 800 lines |
| 2.2.2 | Decompose `DetailedRequirementsTab.tsx` (5,955 lines) | Split into: `FunctionalRequirements`, `NonFunctionalRequirements`, `RequirementsMatrix`, `RequirementsValidation`, `RequirementsTraceability` |
| 2.2.3 | Decompose `PMOOfficePage.tsx` (5,029 lines) | Split into: `PMODashboard`, `PMOPortfolioView`, `PMOResourceView`, `PMOComplianceView`, `PMOReporting` |
| 2.2.4 | Decompose `BusinessCaseTab.tsx` (4,949 lines) | Split into: `BCExecutiveSummary`, `BCFinancialAnalysis`, `BCRiskAssessment`, `BCImplementationPlan`, `BCRecommendations` |
| 2.2.5 | Decompose `PlanningPhaseTab.tsx` (4,834 lines) | Split into: `PlanningScope`, `PlanningSchedule`, `PlanningResources`, `PlanningRisks`, `PlanningCommunications` |
| 2.2.6 | Decompose remaining 11 files > 2,000 lines | `StrategicFitTab`, `IntelligentPortfolioGatewayPage`, `EnterpriseArchitectureTab`, `Intelligence`, `DecisionDetail`, `DemandWizardEnhanced`, `DemandManagementPlan`, `RfpDocumentTab`, `FinancialModelContainer`, `ExecutionCostProcurementHub`, `ProjectCharterView` |
| 2.2.7 | Extract shared UI patterns into reusable components | `ApprovalWorkflow`, `VersionTimeline`, `DataTable`, `MetricsCard`, `StatusBadge`, `EmptyState`, `LoadingOverlay` — reduce code duplication across tabs |

### 2.3 Read Model Separation (Tactical CQRS)  *(Architecture 9→9.5)*

| # | Task | Detail |
|---|------|--------|
| 2.3.1 | Add `IDemandQueryPort` read-only interface | `getDemandDashboard()`, `getDemandReport()`, `searchDemands()` — separate from write operations in `IDemandStoragePort` |
| 2.3.2 | Add `IPortfolioQueryPort` read-only interface | `getPortfolioDashboard()`, `getProjectSummary()`, `getProjectsList()` — the 120-method portfolio port is the worst offender |
| 2.3.3 | Create materialized view for portfolio dashboard | Replace N+1 queries with a single pre-joined view, refreshed on portfolio events |
| 2.3.4 | Add `IGovernanceQueryPort` | Read-only: `getGateStatus()`, `getTenderList()`, `getVendorScores()` |

### 2.4 Frontend State Architecture  *(Frontend 8.5→9)*

| # | Task | Detail |
|---|------|--------|
| 2.4.1 | Standardize API layer per module | Every module has `api/queries.ts` (TanStack Query hooks) + `api/mutations.ts` — no raw `fetch` calls in components |
| 2.4.2 | Add `ErrorBoundary` per route segment | Currently only global; add per-feature error boundaries with retry UI |
| 2.4.3 | Add optimistic updates for workflow actions | Approve/reject/submit actions update UI instantly, roll back on error |
| 2.4.4 | Add Suspense boundaries with skeleton loaders | Replace loading spinners with content-aware skeletons (already have `Skeleton` component) |

---

## Phase 3 — DevOps & CI/CD (Week 7–10)

> **Goal:** Production-grade CI/CD pipeline, monitoring, IaC.
>
> **Score impact:** DevOps 7→9.5, Scalability 7→8.5

### 3.1 Full CI/CD Pipeline  *(DevOps 7→8.5)*

| # | Task | Detail |
|---|------|--------|
| 3.1.1 | Create `ci.yml` GitHub Actions workflow | Jobs: (1) lint+typecheck, (2) server unit tests, (3) client unit tests, (4) build Docker image, (5) E2E tests against built image, (6) push image to GHCR |
| 3.1.2 | Create `deploy-staging.yml` workflow | On merge to `main`: deploy to staging K8s cluster, run smoke tests, notify Slack |
| 3.1.3 | Create `deploy-production.yml` workflow | Manual trigger with approval gate; blue-green or canary deployment via K8s |
| 3.1.4 | Add test coverage reporting to PRs | `vitest-coverage-report` GH Action; fail PR if coverage drops |
| 3.1.5 | Add Docker image scanning in CI | Trivy scan on built image (not just filesystem) |
| 3.1.6 | Create `Makefile` for local dev | `make dev`, `make test`, `make build`, `make deploy-staging` — wraps npm scripts for discoverability |

### 3.2 Observability Stack  *(DevOps 8.5→9.5)*

| # | Task | Detail |
|---|------|--------|
| 3.2.1 | Add OpenTelemetry SDK | `@opentelemetry/api`, `@opentelemetry/sdk-node`, auto-instrumentation for Express, pg, http |
| 3.2.2 | Create `/metrics` Prometheus endpoint | Export from existing `Counter`/`Histogram` classes — they already track AI latency, request duration, error rates |
| 3.2.3 | Add distributed tracing with correlation | Replace custom correlation IDs with OTel trace context propagation (W3C format) |
| 3.2.4 | Add health check dashboard endpoint | `/api/health/detailed` — DB connectivity, Redis connectivity, Brain pipeline status, queue depth, memory usage |
| 3.2.5 | Create Grafana dashboard definitions | JSON files for: system overview, API latency percentiles, AI pipeline performance, error rates, active users |
| 3.2.6 | Add structured log shipping config | Winston → Loki/ELK transport configuration (pluggable, env-gated) |
| 3.2.7 | Add alerting rules | Prometheus alerting: error rate > 5%, p99 latency > 3s, AI pipeline failure, queue backlog > 100, DB connection exhaustion |

### 3.3 Infrastructure as Code  *(DevOps 9.5→10, Scalability 7→8.5)*

| # | Task | Detail |
|---|------|--------|
| 3.3.1 | Create Helm chart for COREVIA | `charts/corevia/` — values.yaml for env-specific config (dev/staging/prod), templates for Deployment, Service, Ingress, HPA, PDB, ConfigMap, Secret |
| 3.3.2 | Add sealed secrets management | `kubeseal` integration for production secrets; template in `charts/corevia/templates/sealed-secret.yaml` |
| 3.3.3 | Create Terraform module for cloud infra | `infra/terraform/` — PostgreSQL (RDS/CloudSQL/Azure PG), Redis (ElastiCache/Memorystore), VPC, DNS, TLS certs |
| 3.3.4 | Add database backup automation | CronJob in K8s: `pg_dump` nightly → S3/GCS with 30-day retention, weekly integrity check |
| 3.3.5 | Add canary deployment config | Flagger or Argo Rollouts integration: 5% → 25% → 50% → 100% with automated rollback on error rate |

---

## Phase 4 — Enterprise Features (Week 9–14)

> **Goal:** API versioning, i18n, feature flags, Redis caching, ADRs.
>
> **Score impact:** Architecture 9.5→10, Documentation 7.5→9, Scalability 8.5→9.5, Security 8.5→9

### 4.1 API Versioning  *(Architecture 9.5→10)*

| # | Task | Detail |
|---|------|--------|
| 4.1.1 | Implement URL-based API versioning | `/api/v1/*` prefix; create `server/app/routes/v1/` mirroring current routes |
| 4.1.2 | Add version negotiation middleware | Accept `API-Version` header as alternative; default to `v1` |
| 4.1.3 | Add deprecation headers | `Sunset` and `Deprecation` headers for future version transitions |
| 4.1.4 | Document versioning policy | In Swagger and `docs/API_VERSIONING.md` — semver-aligned, 6-month deprecation window |

### 4.2 Feature Flag System  *(Scalability 8.5→9)*

| # | Task | Detail |
|---|------|--------|
| 4.2.1 | Create `FeatureFlagService` | DB-backed (new `feature_flags` table) + in-memory cache; API: `isEnabled(flag, context)` |
| 4.2.2 | Add feature flag middleware | `requireFeatureFlag('brain-v2')` — returns 404 if flag disabled |
| 4.2.3 | Add feature flag React hook | `useFeatureFlag('brain-v2')` — guards UI components; SSR-safe |
| 4.2.4 | Create feature flag admin UI | CRUD page in admin module with per-role, per-tenant, percentage rollout support |
| 4.2.5 | Wire Brain pipeline to feature flags | Each of the 8 layers can be toggled via feature flags (complement existing control-plane `enable/disable`) |

### 4.3 Redis Data Caching  *(Scalability 9→9.5)*

| # | Task | Detail |
|---|------|--------|
| 4.3.1 | Implement `RedisCacheAdapter` for `CachePort` | The interface already exists in `server/platform/cache/` — create Redis implementation using existing `ioredis` connection |
| 4.3.2 | Cache portfolio dashboard queries | 30s TTL; invalidate on portfolio domain events |
| 4.3.3 | Cache AI prompt templates | 5-min TTL; invalidate on policy pack update |
| 4.3.4 | Cache user permissions | Per-session; invalidate on role/permission change events |
| 4.3.5 | Add cache hit/miss metrics | Wire into existing `Counter` observability classes; expose via `/metrics` |

### 4.4 Internationalization  *(Frontend 9→9.5)*

| # | Task | Detail |
|---|------|--------|
| 4.4.1 | Install `react-i18next` + `i18next` | Configure with `en` and `ar` (Arabic for UAE) namespaces |
| 4.4.2 | Extract UI strings to translation files | Start with navigation, labels, form fields, error messages, status badges |
| 4.4.3 | Add RTL layout support | Tailwind RTL plugin; `dir="rtl"` toggle based on locale |
| 4.4.4 | Add locale switcher component | Header dropdown: English / العربية |
| 4.4.5 | Add server-side error message i18n | Error responses include `messageKey` for client-side translation |

### 4.5 Architecture Decision Records  *(Documentation 7.5→8.5)*

| # | Task | Detail |
|---|------|--------|
| 4.5.1 | Create `docs/adr/` directory with template | MADR format: Title, Status, Context, Decision, Consequences |
| 4.5.2 | Write 10 retroactive ADRs | (1) Modular monolith over microservices, (2) Drizzle over Prisma/TypeORM, (3) Ports & Adapters storage, (4) TanStack Query over Redux, (5) 8-layer Brain pipeline, (6) Session auth over JWT, (7) PostgreSQL for sessions over Redis-only, (8) Zod shared contracts, (9) Domain event bus in-process, (10) pgvector over external vector DB |
| 4.5.3 | Add ADR creation to PR template | Checkbox: "Does this PR require an ADR? If yes, include it." |

### 4.6 API Consumer Documentation  *(Documentation 8.5→9)*

| # | Task | Detail |
|---|------|--------|
| 4.6.1 | Generate OpenAPI spec from annotated routes | `npm run docs:api` → produces `openapi.json` in `docs/` |
| 4.6.2 | Create API quickstart guide | `docs/API_QUICKSTART.md` — auth flow, first demand creation, version workflow |
| 4.6.3 | Create onboarding developer guide | `docs/DEVELOPER_GUIDE.md` — local setup, architecture overview, module contribution guide |
| 4.6.4 | Add Postman/Bruno collection | Export from Swagger spec; include auth + 20 key workflows as examples |

---

## Phase 5 — Hardening & Polish (Week 13–16)

> **Goal:** Accessibility, performance, migration safety, security hardening.
>
> **Score impact:** Security 9→10, Frontend 9.5→10, Testing 9→10, Documentation 9→10

### 5.1 Accessibility  *(Frontend 9.5→10)*

| # | Task | Detail |
|---|------|--------|
| 5.1.1 | Add `@axe-core/react` in development | Logs a11y violations to console during development |
| 5.1.2 | Add `jest-axe` / `vitest-axe` to component tests | Assert no a11y violations in all component test files |
| 5.1.3 | Add keyboard navigation audit | Ensure all interactive elements are focusable, tab order is logical, no focus traps |
| 5.1.4 | Add ARIA labels to all data tables | Sortable columns, expandable rows, pagination controls — all need semantic markup |
| 5.1.5 | Add screen reader testing for workflow status | Announce approval status changes, version transitions, error states |
| 5.1.6 | Add Playwright a11y E2E tests | `@axe-core/playwright` on 5 critical pages |

### 5.2 Database Migration Safety  *(Testing 9→9.5)*

| # | Task | Detail |
|---|------|--------|
| 5.2.1 | Switch from `db:push` to `db:migrate` | Generate tracked migration files; apply via `drizzle-kit migrate` in CI |
| 5.2.2 | Add down migration generator script | For each `up` migration, generate a corresponding `down` SQL |
| 5.2.3 | Add migration CI job | Run all migrations forward on a clean DB; verify schema matches `db:push` output |
| 5.2.4 | Add schema drift detection | CI job: compare `db:push --dry-run` output with latest migration — fail if schema drifts |

### 5.3 Security Hardening  *(Security 9→10)*

| # | Task | Detail |
|---|------|--------|
| 5.3.1 | Add `express-validator` for path parameters | Zod covers bodies; path params (`:id`, `:demandId`) need type + range validation |
| 5.3.2 | Add request payload size limits per route | Currently global `express.json({ limit })` — add stricter limits on upload routes vs API routes |
| 5.3.3 | Add API key authentication for service-to-service | When microservices topology activates, internal calls need API key auth (not session) |
| 5.3.4 | Add security response headers audit test | E2E test: assert all responses have `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy` |
| 5.3.5 | Rotate dev session secret automatically | Startup check: if `SESSION_SECRET` matches hardcoded fallback AND `NODE_ENV=production`, refuse to boot |
| 5.3.6 | Add npm audit to CI with `--audit-level=high` enforcement | Already in scripts; wire into CI workflow with fail-on-high |

### 5.4 Performance Optimization  *(Scalability 9.5→10)*

| # | Task | Detail |
|---|------|--------|
| 5.4.1 | Add bundle size analysis | `rollup-plugin-visualizer` in vite config; CI tracks bundle size regression |
| 5.4.2 | Add DB query performance monitoring | Log slow queries (>500ms) with explain plans |
| 5.4.3 | Add connection pooling config documentation | `pg` pool size tuning for production with HPA considerations |
| 5.4.4 | Add load testing with k6 | `tests/load/` — 5 scenarios: login storm, demand creation burst, AI pipeline concurrent, portfolio dashboard, document upload |
| 5.4.5 | Add React.memo / useMemo audit | Profile top 10 largest pages; eliminate unnecessary re-renders in data tables, charts |
| 5.4.6 | Add virtual scrolling for large lists | Replace DOM-rendered tables with `@tanstack/react-virtual` for portfolio lists, demand lists, knowledge docs |

### 5.5 Final Documentation  *(Documentation 9→10)*

| # | Task | Detail |
|---|------|--------|
| 5.5.1 | Create `ARCHITECTURE.md` | High-level system diagram (Mermaid), module map, data flow, deployment topology |
| 5.5.2 | Create `RUNBOOK.md` | Operational procedures: restart, rollback, scale up, DB backup restore, incident response |
| 5.5.3 | Create `CONTRIBUTING.md` | Code standards, PR template, module creation guide, test requirements, ADR process |
| 5.5.4 | Create `CHANGELOG.md` | Retroactive changelog for major features; adopt conventional commits going forward |
| 5.5.5 | Add inline JSDoc to all port interfaces | Every method in every `*.port.ts` file gets `/** */` documentation |
| 5.5.6 | Generate architecture diagrams from code | `dependency-cruiser` → SVG dependency graphs per module; stored in `docs/diagrams/` |

---

## Scorecard Projection

| Dimension | Current | After Phase 0–1 | After Phase 2–3 | After Phase 4–5 | Target |
|-----------|:-------:|:----------------:|:----------------:|:----------------:|:------:|
| Architecture & Design | 9 | 9 | 10 | 10 | **10** |
| AI/ML Integration | 9 | 9 | 9 | 9.5 | **10** |
| Security | 8 | 8.5 | 8.5 | 10 | **10** |
| Domain Modeling | 8 | 8 | 9.5 | 10 | **10** |
| Code Quality Tooling | 8 | 8.5 | 9 | 10 | **10** |
| DevOps / Deployment | 7 | 7.5 | 9.5 | 10 | **10** |
| Documentation | 7 | 7.5 | 7.5 | 10 | **10** |
| Scalability | 7 | 7 | 8.5 | 10 | **10** |
| Frontend Architecture | 6 | 6 | 9 | 10 | **10** |
| Testing | 3 | 8 | 9 | 10 | **10** |
| **OVERALL** | **7.2** | **7.9** | **9.0** | **10.0** | **10.0** |

---

## Priority Execution Order

```
CRITICAL PATH (do first — highest ROI):
  Phase 1.1  Server domain tests          → Testing 3→5   (biggest gap)
  Phase 1.2  Frontend testing setup        → Testing 5→6
  Phase 1.3  E2E tests                     → Testing 6→8
  Phase 2.1  IStorage decomposition        → Domain 8→9.5
  Phase 2.2  Frontend decomposition        → Frontend 6→8.5

HIGH VALUE (do next):
  Phase 3.1  Full CI/CD pipeline           → DevOps 7→8.5
  Phase 3.2  Observability stack           → DevOps 8.5→9.5
  Phase 0.1  Fix Docker Compose            → DevOps 7→7.5
  Phase 4.5  ADRs                          → Docs 7.5→8.5
  Phase 4.1  API versioning                → Arch 9.5→10

COMPLETE THE PICTURE (do last):
  Phase 3.3  IaC (Helm + Terraform)        → DevOps 9.5→10
  Phase 4.2  Feature flags                 → Scale 8.5→9
  Phase 4.3  Redis caching                 → Scale 9→9.5
  Phase 4.4  i18n                          → Frontend 9→9.5
  Phase 5.*  Hardening & polish            → All → 10
```

---

## Implementation Notes

### What NOT to Do
- **Do not rewrite to microservices** — the modular monolith is the right architectural choice at this stage. The active Docker surface is monolith-only and should stay that way unless operating evidence justifies a real split.
- **Do not adopt Redux/Zustand** — TanStack Query for server state is the correct pattern. Avoid adding client-side state management complexity.
- **Do not add Event Sourcing** — the domain events + mutable state pattern is pragmatic and correct for this domain. Event sourcing would add massive complexity with minimal governance benefit.
- **Do not change the ORM** — Drizzle is lightweight and well-integrated. The 153-table schema works well with it.

### Prerequisites
- **Testcontainers** or **Docker-in-CI PostgreSQL** for repository integration tests
- **Playwright browsers** installed in CI Docker image
- **OpenTelemetry Collector** sidecar for K8s deployment (Grafana Cloud or self-hosted)
- **Redis 7+** for data caching (already in compose; just needs application wiring)

---

*Generated: February 25, 2026*
*Baseline: COREVIA Architecture Assessment v1*
