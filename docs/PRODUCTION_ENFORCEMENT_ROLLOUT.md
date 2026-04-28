# Production Enforcement Rollout (Scope B)

This is the operational rollout for **platform-wide** Corevia enforcement:
- Single AI gateway (no direct OpenAI/Anthropic SDK use in feature modules)
- IPLAN hash + IPLAN immutability
- Network egress restricted (K8s NetworkPolicies)
- DB RBAC split (Brain RW vs other services RO)

Assumptions (based on your answers):
- Kubernetes namespace: `corevia`
- Postgres database: `heliumdb`
- External managed Postgres (CIDR must be provided)

## 1) Apply DB migration (IPLAN hash + immutability)

This repo includes the canonical migration: `infrastructure/migrations/0006_intelligence_plans_hash_immutable.sql`

Run (from a machine that can reach Postgres):
- `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infrastructure/migrations/0006_intelligence_plans_hash_immutable.sql`

Verification:
- `psql "$DATABASE_URL" -c "\\d intelligence_plans" | grep iplan_hash`
- Attempting an UPDATE should fail:
  - `psql "$DATABASE_URL" -c "update intelligence_plans set redaction_mode='NONE' where 1=0;"`

## 2) Apply DB RBAC (Brain RW, services RO)

Use: `docs/db-rbac-corevia.sql`

Run:
- `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/db-rbac-corevia.sql`

Then update your deployments so:
- Brain service uses a DB user that is a member of `corevia_brain_rw`
- All other services use a DB user that is a member of `corevia_services_ro`

## 3) Apply Kubernetes NetworkPolicies

These are templates under `docs/k8s/`.

### 3.1 Apply baseline policies
- `kubectl -n corevia apply -f docs/k8s/networkpolicy-default-deny-egress.yaml`
- `kubectl -n corevia apply -f docs/k8s/networkpolicy-allow-dns-egress.yaml`

### 3.2 Allow Postgres egress
Edit `docs/k8s/networkpolicy-allow-postgres-egress.yaml`:
- Set the managed Postgres CIDR(s) in `ipBlock.cidr`

Then apply:
- `kubectl -n corevia apply -f docs/k8s/networkpolicy-allow-postgres-egress.yaml`

### 3.3 Allow HTTPS egress ONLY for Redaction Gateway
Apply:
- `kubectl -n corevia apply -f docs/k8s/networkpolicy-allow-external-egress-redaction-gateway.yaml`

Important:
- Ensure your redaction gateway pods have label: `app=redaction-gateway`

## 4) CI enforcement

Repo-wide boundary check is wired into:
- `npm run security:check`

Run locally/CI:
- `npm run security:check`

## 5) Smoke checks

- `kubectl -n corevia get networkpolicy`
- `kubectl -n corevia rollout status deploy/<brain-deployment-name>`
- Verify `/api/corevia/stats/engines` loads in Brain Console and shows enforcement metrics.

---

## Docker VM note
Docker Compose alone won’t enforce egress the way K8s NetworkPolicies do. For a VM deployment, you’ll need host firewall rules (e.g. `ufw`/iptables) to:
- Allow outbound 5432 only to Postgres
- Allow outbound 443 only from the redaction-gateway container
- Deny all other outbound traffic
