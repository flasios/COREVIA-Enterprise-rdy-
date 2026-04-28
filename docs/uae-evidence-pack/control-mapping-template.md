# Control Mapping Template

Use this matrix to map UAE authority controls to implementation and evidence.

| Control ID | Control Statement | Implementation Location | Evidence IDs | Owner | Validation Method | Status |
| --- | --- | --- | --- | --- | --- | --- |
| UAE-CTRL-001 | Privileged access requires MFA | IdP policy + privileged groups | EV-001 | Security Administrator | Config review + login test | Pending |
| UAE-CTRL-002 | Enterprise SSO enforced | SAML/OIDC settings | EV-002 | Identity Engineer | SSO flow test | Pending |
| UAE-CTRL-003 | CSRF/session controls enabled in prod | `apps/api/index.ts`, `interfaces/middleware/sessionSecurity.ts` | EV-003 | Application Security | Security regression tests | Pending |
| UAE-CTRL-004 | Static and dependency security checks | CI workflow | EV-004 | Application Security | CI gate review | Pending |
| UAE-CTRL-005 | WAF and edge protections active | Edge/WAF platform | EV-005 | Platform Engineer | WAF test suite | Pending |
| UAE-CTRL-006 | Segmented network architecture | VPC and firewall rules | EV-006 | Cloud Security | Architecture review | Pending |
| UAE-CTRL-007 | Security logs centralized and retained | SIEM forwarding and retention policies | EV-007 | SOC Lead | Log sampling and retention check | Pending |
| UAE-CTRL-008 | IR process tested and documented | Incident runbook and tabletop | EV-008 | IR Manager | Tabletop exercise record | Pending |
| UAE-CTRL-009 | Restore capability tested | Backup/restore tooling and reports | EV-009 | Operations Lead | Restore drill | Pending |
| UAE-CTRL-010 | Independent security assurance completed | Third-party test and remediation | EV-010 | CISO | Pen-test closure review | Pending |

## Notes
- Replace control IDs with your target authority's official identifiers.
- Keep all dates in ISO format (`YYYY-MM-DD`).
- Link evidence IDs back to `docs/uae-evidence-pack/evidence-register.csv`.
