# COREVIA Best Practices Audit

Date: 2026-02-15
Scope: Architecture, security, frontend maintainability, and developer workflow.

## Executive Verdict

The platform is operational and significantly improved, but **not fully aligned with end-to-end best practices** yet.

- Runtime stability: healthy in local dev (Postgres + Redis + app health check).
- Typecheck: passing (`npm run check`).
- Build: passing (`npm run build`) with chunk-size/circular warnings.
- Security audit (prod deps): passing (`npm run security:audit` => 0 high/critical vulnerabilities).
- Lint: failing heavily, primarily due to broad `@ts-nocheck` usage.

## Priority Findings

## P0 (Immediate)

1. **Type-safety bypass is systemic (`@ts-nocheck`)**
   - Count: `206` files total (`client: 109`, `server: 97`).
   - Impact: hides real typing defects and weakens refactor safety.
   - Evidence examples:
     - `client/src/modules/pages/intelligentGateway.AssessmentWorkspace.tsx`
     - `server/index.ts`
     - `server/services/content-generation/businessCaseGenerator.ts`

2. **Lint gate is red and not release-safe as policy**
   - `npm run lint` output: `283 problems (207 errors, 76 warnings)`.
   - Dominant error family: `@typescript-eslint/ban-ts-comment` for `@ts-nocheck`.
   - Impact: governance drift and reduced confidence in quality gates.

## P1 (High)

3. **Very large files remain in critical flows (modularity risk)**
   - Examples:
   - `client/src/modules/portfolio/workspace/components/tabs/ExecutionPhaseTab.tsx` (8609 lines)
     - `server/storage/postgres.ts` (6768 lines)
     - `client/src/components/tabs/DetailedRequirementsTab.tsx` (5693 lines)
     - `server/services/content-generation/businessCaseGenerator.ts` (4718 lines)
   - Impact: higher change risk, review fatigue, testability decline.

4. **Security docs drift from live implementation history**
   - Existing report references old findings (e.g., pending package vulnerabilities/rate limiting notes) that no longer reflect current runtime checks.
   - Impact: compliance/reporting mismatch for stakeholders.

## P2 (Medium)

5. **Frontend bundle strategy still emits chunk warnings**
   - Build previously reported circular chunk warnings and large chunk warnings despite custom `manualChunks`.
   - Impact: potential startup/perf regressions on low-bandwidth clients.

6. **Security middleware still contains global TS suppression**
   - `server/middleware/security.ts` currently starts with `@ts-nocheck`.
   - Impact: core security code not type-protected.

## Strengths Observed

- Strong CI security posture exists: CodeQL, Semgrep, Trivy FS scan, Gitleaks, SBOM generation (`.github/workflows/security-gate.yml`).
- Architectural boundary lint rules are present in ESLint for app/page layering and server route import boundaries.
- Runtime hardening in place: CSP, CORS controls, rate limiting, CSRF/session protections in server stack.
- Local ops reliability improved with scripted boot/doctor flow.

## Recommended Remediation Plan

### Phase 1 (1-2 weeks)
- Create a tracked **`@ts-nocheck` burn-down plan**:
  - Block new uses via lint rule enforcement in changed files.
  - Remove from top 20 high-change files first.
- Establish CI sequence: `check` + `lint` required for merge (or scoped lint baseline strategy).
- Update security assessment docs to match current audited state.

### Phase 2 (2-4 weeks)
- Break up 5 biggest frontend files and 3 biggest server files into domain modules.
- Add targeted unit tests around refactored seams.
- Remove `@ts-nocheck` from security/auth/session related files first.

### Phase 3 (4-6 weeks)
- Revisit Vite chunk strategy to reduce `vendor-misc` pressure and circular chunking.
- Introduce performance budgets (bundle size thresholds + regression checks).
- Formalize architecture decision records (ADRs) for route/module boundaries.

## Suggested KPIs

- `@ts-nocheck` count: 206 -> <120 (Phase 1) -> <40 (Phase 2) -> 0 target.
- Lint errors: 207 -> <20 (Phase 1) -> 0 target.
- Files >2000 lines: reduce by 50% in Phase 2.
- Bundle warnings: 0 circular warning target by Phase 3.

## Commands Used During Audit

- `npm run check`
- `npm run build`
- `npm run lint`
- `npm run security:audit`
- line-count and `@ts-nocheck` scans across `client/src` and `server`
