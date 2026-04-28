# COREVIA Enterprise Architecture (Government-Ready)

## 1) Architecture Objective
Provide a production-grade, government-deployable architecture for COREVIA with:
- clear bounded contexts,
- strict security and audit controls,
- data sovereignty alignment,
- predictable release governance,
- scalable module ownership.

## 2) Target Runtime Topology
- **Presentation Layer**: React SPA (`client`) served behind ingress/WAF.
- **Application API Layer**: Node.js API gateway (`server`) with session, auth, CSRF, RBAC.
- **Domain Services Layer**: Internal modules (Demand, Knowledge, Compliance, Intelligence, Integration, Notifications).
- **Data Layer**: PostgreSQL (+ pgvector), Redis (queues/session cache), object storage for evidence.
- **Security & Observability Layer**: SIEM forwarding, audit log pipeline, correlation IDs, health/readiness probes.

## 3) Government Control Alignment (Implementation Intent)
- **Identity**: enterprise SSO integration (OIDC/SAML), MFA for privileged access.
- **Access Control**: permission-based RBAC already present; enforce periodic recertification process.
- **Data Protection**: TLS in transit, encryption at rest, key rotation via managed KMS/HSM.
- **Auditability**: immutable audit events for privileged actions and workflow state changes.
- **Sovereignty**: host DB, backups, logs, and AI processing in approved UAE residency boundary.
- **Operational Assurance**: WAF, DDoS controls, vulnerability scans, signed image pipeline.

## 4) Bounded Context Map
- **Identity & Access**: authentication, sessions, role/permission checks.
- **Demand Management**: intake, analysis, conversion, reporting.
- **Portfolio & Projects**: portfolio analytics, project lifecycle.
- **Knowledge & RAG**: document ingest, graph/search, briefings, insights.
- **Compliance & Governance**: controls mapping, gates, policy packs, audit links.
- **COREVIA Brain**: intelligence engine orchestration and decision spine.
- **Integrations**: connectors and external system contracts.
- **Notifications**: channel orchestration and delivery tracking.

## 5) Data Classification Baseline
- **Restricted**: credentials, session material, security events.
- **Confidential**: assessments, reports, tenders, vendor evaluations.
- **Internal**: operational telemetry and non-sensitive analytics.
- **Public**: system health metadata only.

All logs/events must avoid sensitive content leakage and follow retention policy by class.

## 6) Reference Request Flow
1. Request enters through ingress/WAF.
2. Correlation ID assigned.
3. Security middleware (headers, CORS, CSRF, rate-limit).
4. Session/auth + tenant scope.
5. Domain route handler delegates to application service.
6. Application service calls domain/repository/integration ports.
7. Audit/security events emitted.
8. Response returned with trace context.

## 7) Deployment Architecture (Recommended)
- **Kubernetes namespaces**: `corevia-app`, `corevia-data`, `corevia-observability`.
- **Ingress**: TLS termination + WAF policy + strict origin controls.
- **Runtime**: stateless API pods, horizontal scaling by CPU/RPS.
- **Stateful**: managed PostgreSQL/Redis with backups and failover.
- **Secrets**: vault/KMS-backed, no static long-lived secrets in repo.
- **CI/CD gates**: SAST, SCA, IaC scan, secrets scan, SBOM, image signing.

## 8) Architecture Decisions (Now)
- Keep current stack (React + Express + Drizzle + PostgreSQL) to reduce migration risk.
- Move from broad folder grouping to strict module-first boundaries.
- Keep one deployable API process initially; evolve to service split only when justified by load/compliance isolation.
- Centralize cross-cutting concerns: security, logging, validation, error contracts.

## 9) Success Criteria
- 100% API endpoints mapped to explicit module ownership.
- 0 direct cross-module DB coupling (use service/port contracts only).
- Security controls enforceable by config and validated at startup.
- Deployment evidence pack generated per release.
