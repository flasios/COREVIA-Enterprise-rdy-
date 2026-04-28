# Deployment Checklist

Use this checklist together with:

- `docs/LAUNCH_READINESS_CHECKLIST.md`
- `docs/RELEASE_RUNBOOK.md`
- `docs/ROLLBACK_RUNBOOK.md`
- `docs/STAGING_SMOKE_GATE.md`
- `docs/uae-evidence-pack/signoff-template.md`

## Security
- Set strong `SESSION_SECRET` (>=32 chars) in production.
- Set `ALLOWED_ORIGINS` for production CORS.
- Set `TRUST_PROXY=true` when behind an ingress/load balancer.
- Keep `.env` files out of git and rotate any leaked keys.
- Review CSP report logs for violations before enforcing strict CSP.
- Apply platform enforcement rollout: see `docs/PRODUCTION_ENFORCEMENT_ROLLOUT.md`.

## Performance
- Enable gzip/brotli at the reverse proxy if available.
- Monitor bundle sizes and lazy-load large screens.

## Observability
- Confirm health endpoints: `/health` and `/health/ready`.
- Confirm API health endpoints: `/api/health` and `/api/health/ready`.
- Confirm metrics endpoint: `/metrics`.
- Capture `X-Correlation-ID` and `X-Request-ID` in logs.
- Ship logs to a central store if possible.

## Data Safety
- Verify upload size limits and file type filters.
- Ensure evidence files are access-controlled.

## UAE Government Readiness
- Confirm data residency for DB, backups, and logs.
- Ensure AI providers and storage comply with UAE data sovereignty policy.

## Quality
- Run `npm run build` and targeted smoke tests before deploy.
- Run `npm run quality:release` for release candidates.
- Run the critical journey suite in `docs/STAGING_SMOKE_GATE.md` before production approval.
