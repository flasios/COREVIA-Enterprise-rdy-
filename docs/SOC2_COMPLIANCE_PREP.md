# COREVIA — SOC 2 Type II Compliance Preparation

## Overview

This document outlines the SOC 2 Type II readiness posture for the COREVIA
Government Portfolio Intelligence Platform, mapped against the five Trust
Service Criteria (TSC).

---

## 1. Security (Common Criteria — CC)

### CC1: Control Environment

| Control | Status | Evidence |
|---------|--------|----------|
| Defined organizational structure with roles | ✅ Implemented | RBAC system with 5 roles: super_admin, admin, pmo_officer, project_manager, viewer |
| Security policies documented | ✅ Documented | [SECURITY_ASSESSMENT.md](../SECURITY_ASSESSMENT.md), [security_best_practices_report.md](../security_best_practices_report.md) |
| Background checks for personnel | ⬜ Process | HR policy required |

### CC2: Communication & Information

| Control | Status | Evidence |
|---------|--------|----------|
| Security incident response plan | 🟡 Partial | Chaos engineering runbook covers technical scenarios |
| User notification procedures | ⬜ Required | Email notification system needed |
| Change management process | ✅ Implemented | Git-based workflow with PR reviews |

### CC3: Risk Assessment

| Control | Status | Evidence |
|---------|--------|----------|
| Annual risk assessment | ✅ Documented | Architecture assessment (7.2/10), security audit |
| Threat modeling | 🟡 Partial | SECURITY_ASSESSMENT.md covers OWASP Top 10 |
| Vulnerability scanning | ⬜ Required | Integrate Snyk/Dependabot into CI |

### CC5: Control Activities

| Control | Status | Evidence |
|---------|--------|----------|
| Access control — authentication | ✅ Implemented | Session-based auth with bcrypt password hashing |
| Access control — authorization | ✅ Implemented | Role-based middleware: `requireRole()`, `requirePlatformRole()` |
| Input validation | ✅ Implemented | Zod schema validation on all API endpoints |
| Encryption at rest | 🟡 Partial | PostgreSQL pgcrypto available; storage encryption TBD |
| Encryption in transit | ✅ Implemented | HTTPS/TLS enforced via reverse proxy |
| Rate limiting | ✅ Implemented | 5 rate limiters: general, AI, upload, strict, auth |
| CSRF protection | ✅ Implemented | Double-submit cookie pattern (XSRF-TOKEN) |
| Session management | ✅ Implemented | express-session with PostgreSQL store, secure cookie flags |

### CC6: Logical & Physical Access

| Control | Status | Evidence |
|---------|--------|----------|
| MFA | ⬜ Required | Not yet implemented |
| Password complexity | ✅ Implemented | Minimum 8 characters, bcrypt cost factor 12 |
| Session timeout | ✅ Implemented | 24-hour session expiry |
| Audit logging | 🟡 Partial | API request logging via observability middleware; user-level audit trail needed |
| Physical access controls | N/A | Cloud-hosted (UAE data centers) |

### CC7: System Operations

| Control | Status | Evidence |
|---------|--------|----------|
| Monitoring & alerting | ✅ Implemented | Prometheus metrics, health endpoint, observability middleware |
| Incident detection | 🟡 Partial | Error rate monitoring; SIEM integration needed |
| Backup & recovery | 🟡 Partial | PostgreSQL backup strategy documented; automated backups TBD |
| Capacity planning | ✅ Documented | k6 load test with thresholds |

### CC8: Change Management

| Control | Status | Evidence |
|---------|--------|----------|
| Version control | ✅ Implemented | Git with GitHub |
| Code review process | ✅ Implemented | PR-based workflow |
| CI/CD pipeline | ✅ Implemented | GitHub Actions (.github/workflows/) |
| Database migrations | ✅ Implemented | Drizzle ORM with versioned migrations |
| Feature flags | ✅ Implemented | Feature flag system with gradual rollout |

---

## 2. Availability (A)

| Control | Status | Evidence |
|---------|--------|----------|
| SLA defined | ⬜ Required | 99.9% target for government services |
| Health checks | ✅ Implemented | `/api/health` endpoint with DB connectivity check |
| Load testing | ✅ Implemented | k6 load test script with smoke/load/stress scenarios |
| Disaster recovery plan | 🟡 Partial | Docker-based deployment allows quick rebuild |
| Kubernetes deployment | ✅ Documented | Helm charts and K8s manifests in docs/k8s/ |
| Auto-scaling | 🟡 Partial | HPA configured but not tested in production |
| Chaos engineering | ✅ Documented | 7 experiments in CHAOS_ENGINEERING_RUNBOOK.md |

---

## 3. Processing Integrity (PI)

| Control | Status | Evidence |
|---------|--------|----------|
| Input validation | ✅ Implemented | Zod schemas for all API inputs |
| Data consistency | ✅ Implemented | PostgreSQL transactions, FK constraints |
| Immutable audit trail | 🟡 Partial | Version history on business cases; full audit log needed |
| AI output validation | ✅ Implemented | JSON parsing with fallback, AI response guardrails |
| Financial calculations | ✅ Implemented | Server-side NPV/IRR/ROI with version tracking |

---

## 4. Confidentiality (C)

| Control | Status | Evidence |
|---------|--------|----------|
| Data classification | 🟡 Partial | Government data sensitivity levels recognized |
| Access restrictions | ✅ Implemented | RBAC with role-based API access |
| Data masking | ⬜ Required | PII masking in logs not yet implemented |
| Secure file storage | ✅ Implemented | Upload validation, file type restrictions |
| API key management | 🟡 Partial | Environment variables; secrets management TBD |

---

## 5. Privacy (P)

| Control | Status | Evidence |
|---------|--------|----------|
| Privacy notice | ⬜ Required | User-facing privacy policy needed |
| Consent management | ⬜ Required | Cookie consent and data processing consent |
| Data retention policy | ⬜ Required | Define retention periods for demands/projects |
| Right to deletion | ⬜ Required | Account deletion workflow needed |
| Data minimization | ✅ Implemented | Collect only necessary fields per domain |

---

## Readiness Score

| Trust Service Criteria | Controls | Implemented | Partial | Missing |
|----------------------|----------|-------------|---------|---------|
| Security (CC) | 22 | 14 (64%) | 5 (23%) | 3 (14%) |
| Availability (A) | 7 | 4 (57%) | 2 (29%) | 1 (14%) |
| Processing Integrity (PI) | 5 | 4 (80%) | 1 (20%) | 0 (0%) |
| Confidentiality (C) | 5 | 2 (40%) | 2 (40%) | 1 (20%) |
| Privacy (P) | 5 | 1 (20%) | 0 (0%) | 4 (80%) |
| **Total** | **44** | **25 (57%)** | **10 (23%)** | **9 (20%)** |

---

## Priority Remediation Roadmap

### Phase A — Quick Wins (1-2 weeks)
1. Enable Dependabot / Snyk for vulnerability scanning
2. Implement PII masking in server logs
3. Add user-level audit logging middleware
4. Create data retention policy document
5. Add privacy notice page to frontend

### Phase B — Core Controls (2-4 weeks)
6. Implement MFA (TOTP or WebAuthn)
7. Set up automated PostgreSQL backups with point-in-time recovery
8. Integrate SIEM (CloudWatch / Datadog / Splunk)
9. Define and publish SLA documentation
10. Implement account deletion workflow

### Phase C — Certification Prep (4-8 weeks)
11. Engage SOC 2 auditor for gap assessment
12. Establish formal incident response plan
13. Conduct penetration testing
14. Complete evidence collection for audit period
15. Board approval of information security policy

---

## Evidence Collection Locations

| Evidence Type | Location |
|---------------|----------|
| Access control config | `interfaces/middleware/auth.ts`, `shared/schema.ts` |
| Rate limiting | `interfaces/middleware/rateLimiter.ts` |
| Input validation | `domains/*/api/*.ts` (Zod schemas) |
| Encryption | `interfaces/middleware/auth.ts` (bcrypt), TLS certificates |
| Monitoring | `platform/observability/` |
| CI/CD | `.github/workflows/` |
| Architecture docs | `docs/ENTERPRISE_ARCHITECTURE_GOVERNMENT.md` |
| Security assessment | `SECURITY_ASSESSMENT.md` |
| Load testing | `infrastructure/scripts/load-test.js` |
| Chaos engineering | `docs/CHAOS_ENGINEERING_RUNBOOK.md` |
| Database schema | `shared/schema.ts`, `migrations/` |
| Feature flags | `platform/feature-flags/` |
