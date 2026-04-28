# Kubernetes Deployment Notes

## Required environment variables
- `DATABASE_URL`
- `SESSION_SECRET`
- `ALLOWED_ORIGINS`
- `TRUST_PROXY=true`
- `PORT=5000`
- `NODE_ENV=production`
- `ENABLE_REDIS=true|false`

## Ingress / Service
- Expose port 5000 via ClusterIP + Ingress.
- Terminate TLS at the ingress.
- Set `X-Forwarded-For` and `X-Forwarded-Proto` headers.

## Runtime model
- Deploy COREVIA as an API-centric workload plus a dedicated worker workload for queue-backed background jobs.
- Keep PostgreSQL and Redis as managed dependencies or separate stateful workloads.
- Do not model the current platform as per-domain microservices in Kubernetes.

For transitional or minimal environments, the API can still run with `COREVIA_INLINE_WORKER=true`, but the production target should be a separate worker deployment.

## Health checks
- Liveness: `/api/health`
- Readiness: `/api/health/ready`
- Worker liveness: `/health`
- Worker readiness: `/health/ready`

## Secrets
- Store secrets in KMS/Vault and inject via sealed secrets or external secrets.
- Do not commit `.env` files.
- The Helm chart expects production secrets via `secretEnv` in `values-production.yaml` or an external secret management overlay.

## Metrics
- `/metrics` is protected by `METRICS_AUTH_TOKEN` in production unless `ALLOW_PUBLIC_METRICS=true` is explicitly set.
- Prefer restricting metrics access at the network layer as well.

## Backups
- Use `infrastructure/scripts/backup-db.sh` and `infrastructure/scripts/restore-db.sh` for operator-managed backup and restore.
- The Helm chart includes an optional `backup` CronJob for scheduled logical PostgreSQL dumps.

## Enforcement (required for production)
- Apply IPLAN immutability migration: `infrastructure/migrations/0006_intelligence_plans_hash_immutable.sql`
- Apply DB RBAC split: `docs/db-rbac-corevia.sql`
- Apply NetworkPolicies under `docs/k8s/` (deny egress by default; allow only DNS + Postgres; allow HTTPS egress only for `app=redaction-gateway`).
- Full operator steps: `docs/PRODUCTION_ENFORCEMENT_ROLLOUT.md`

## Scaling
- Use HPA based on CPU and memory.
- Consider separate node pools for heavy AI workloads.
- Scale `processing-worker` independently from `api` when queue backlog, retries, or long-running jobs rise.

## Notes
- If ingress rewrites are not used, keep the application listening on port `5000`.
- Session security depends on correct forwarded headers and trusted proxy configuration.
