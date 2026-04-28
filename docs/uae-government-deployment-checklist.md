# UAE Government Deployment Readiness Checklist

## Scope
This checklist is for production deployment of COREVIA to UAE government environments.
It should be completed with your legal/compliance owner and the target authority (federal or emirate-specific).

## 1. Regulatory and Contractual
- [ ] Confirm target authority and control baseline (federal, Dubai, Abu Dhabi, or sector-specific).
- [ ] Confirm UAE data residency requirements and hosting boundaries in contract.
- [ ] Document lawful basis and data processing records for personal data.
- [ ] Define retention and deletion schedule for operational, audit, and user data.
- [ ] Complete DPIA/PIA and obtain stakeholder approvals.

## 2. Identity and Access
- [ ] Enforce MFA for all privileged accounts.
- [ ] Integrate with enterprise IdP/SSO (SAML/OIDC) and disable local admin where possible.
- [ ] Implement least privilege role mapping and quarterly access recertification.
- [ ] Enable account lockout and anomaly-based auth alerts.
- [ ] Enforce session timeout, inactivity timeout, and re-auth for sensitive actions.

## 3. Application Security
- [x] CSRF enforcement enabled in production (`CSRF_STRICT_MODE=true`).
- [x] CSP in enforce mode without unsafe script execution.
- [x] Rate limits configured for auth, API, and upload endpoints.
- [ ] Input validation and output encoding reviewed for all external interfaces.
- [x] File upload pipeline includes MIME validation and malware scanning.

## 4. Platform and Infrastructure
- [ ] TLS 1.2+ with approved cipher suites and automated certificate rotation.
- [ ] Network segmentation for app, DB, Redis, and worker planes.
- [ ] WAF and DDoS protections configured and tested.
- [ ] Redis/BullMQ durable queue configured with persistence and failover.
- [ ] Immutable infrastructure and golden image hardening baseline applied.

## 5. Data Protection
- [ ] Encryption in transit and at rest enabled for all stores and backups.
- [ ] KMS/HSM-backed key management and rotation policy implemented.
- [ ] Secrets managed in vault, not in code or static env files.
- [ ] Sensitive data classification and masking in logs completed.
- [ ] Backup/restore tested with documented RPO/RTO.

## 6. Monitoring, Logging, and Incident Response
- [ ] Centralized SIEM forwarding for security and audit logs.
- [ ] Tamper-evident audit trail retention configured per policy.
- [ ] Alert runbooks and incident severity matrix approved.
- [ ] 24x7 on-call escalation model established.
- [ ] Incident reporting obligations and timelines documented.

## 7. SDLC and Supply Chain
- [x] CI gates for SAST, SCA, secrets scanning, and IaC scanning.
- [ ] Dependency patch cadence and emergency patch process approved.
- [x] SBOM generated per release and archived.
- [ ] Container images signed and verified at deploy time.
- [ ] Penetration test completed and critical findings closed.

## 8. Go-Live Evidence Pack
- [ ] Architecture diagrams and data flow diagrams.
- [ ] Threat model and risk register with mitigation status.
- [ ] Security test reports (SAST/DAST/pentest).
- [ ] Access control matrix and admin account inventory.
- [ ] Backup/DR test evidence and incident tabletop report.

## Current COREVIA Delta (Now)
- [x] CSRF middleware and token propagation implemented.
- [x] Auth origin enforcement on login/register/logout (`CSRF_ENFORCE_AUTH_ORIGIN=true`).
- [x] Auth rate limiter hardened.
- [x] Vendor proposal processing moved to durable BullMQ queue.
- [x] Upload filename sanitization for vendor proposals.
- [x] Session-check endpoint added for frontend auth monitor.
- [x] Malware scanning and file content validation across all upload paths.
- [x] Session fixation protection (session ID rotation on login/register).
- [x] Self-registration blocked by default in production (`ALLOW_SELF_REGISTER=false`).
- [x] Session hardening baseline enforced (12h max cookie lifetime, 30m inactivity timeout, rolling renewal).
- [x] Login redirect hardened to internal paths only.
- [x] CI security gate expanded (`.github/workflows/security-gate.yml`) with CodeQL, Semgrep, Trivy, gitleaks, prod dependency audit, and security regression tests.
- [x] CycloneDX SBOM generation and artifact publishing in CI.
- [x] Production startup fail-fast for security-critical env controls.
- [x] UAE evidence-pack templates added (`docs/uae-evidence-pack/`).
- [ ] UAE control-mapping package (authority-specific) and formal sign-off.

## Validation Snapshot (2026-02-14)
- [x] Build health verified (`npm run build` passes).
- [x] Type-check baseline verified (`npm run check` passes).
- [x] Security regression tests verified (`npm run test:security` passes).
- [x] Auth/session hardening validated end-to-end (csrf-token, login/register, `/api/auth/me`, logout).
- [x] Post-auth CSRF rotation fix verified in runtime flow.
- [x] Demand and business-case API smoke checks completed (no 5xx failures).
- [x] Project workspace API smoke checks completed (no 5xx failures, read/write probes exercised).
- [x] Project workspace contract-compatibility hardening applied for conversion + risks/issues/wbs/stakeholders/gates payload/route aliases.
- [x] Superadmin temporary test credential rotated after validation.
- [ ] Complete authority-specific evidence mapping and obtain formal sign-off.
