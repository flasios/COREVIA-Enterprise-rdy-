# COREVIA Deployment Architecture

Date: 2026-03-10

## Purpose

This document summarizes the deployment shape that the repository structure should support.

## Deployment Thesis

COREVIA should deploy as a governance-first, container-ready modular platform.

In the near term, that means:

- modular-monolith application deployment,
- containerized runtime,
- managed stateful dependencies,
- controlled ingress and security boundaries,
- future extraction only where evidence justifies it.

## Current Repository Signals

The repository now exposes its deployment assets through the canonical infrastructure root:

- `infrastructure/docker/api.Dockerfile`
- `infrastructure/docker/docker-compose.yml`
- `infrastructure/charts/`
- `infrastructure/infra/`
- `infrastructure/migrations/`
- `infrastructure/scripts/`

This is now the authoritative operational surface for the repository.

## Recommended Deployment View

The intended runtime shape is:

```text
Users
  -> ingress / WAF
  -> COREVIA application
  -> platform services and Brain-controlled workflows
  -> Postgres / Redis / object storage / observability stack
```

## Infrastructure Repository Direction

The repository should keep deployment concerns grouped under the infrastructure-oriented root:

```text
infrastructure/
  docker/
  charts/
  infra/
  deployment/
  scripts/
  migrations/
```

## Operational Principles

1. stateless application runtime, stateful managed dependencies,
2. environment-specific configuration through typed configuration and deployment tooling,
3. auditable deployment and rollback process,
4. secure ingress and session boundaries,
5. container-first development and deployment support.

## Current Docker Reality

The active Docker surface is intentionally monolith-only:

- `infrastructure/docker/docker-compose.yml` is the canonical Docker stack for `api`, PostgreSQL, and Redis.
- there is no active gateway container or per-service Docker topology in the current operating model.

If the runtime model grows later, the next legitimate container candidates are:

- `processing-worker` for queue/background execution
- `ai-service` for dedicated model execution
- `web` only if the frontend is split into an independently deployed runtime

This runtime expansion should be treated as post-launch work, after the current monolith/API-shell closeout and launch-readiness hardening are complete.

## Relation To Brain And Domains

Deployment architecture must preserve:

- one canonical Brain and Decision Spine flow,
- consistent platform security and observability,
- modular domain boundaries inside the deployable runtime.

The deployment model should never obscure those ownership lines.

## Primary References

- [../DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md)
- [../LAUNCH_READINESS_CHECKLIST.md](../LAUNCH_READINESS_CHECKLIST.md)
- [../RELEASE_RUNBOOK.md](../RELEASE_RUNBOOK.md)
- [../ROLLBACK_RUNBOOK.md](../ROLLBACK_RUNBOOK.md)
- [../STAGING_SMOKE_GATE.md](../STAGING_SMOKE_GATE.md)
- [../K8S_DEPLOYMENT.md](../K8S_DEPLOYMENT.md)
- [ENTERPRISE_LAUNCH_PLAN.md](ENTERPRISE_LAUNCH_PLAN.md)
- [../../infrastructure/docker/docker-compose.yml](../../infrastructure/docker/docker-compose.yml)
- [API_SHELL_CLOSEOUT_TASKS.md](API_SHELL_CLOSEOUT_TASKS.md)
- [REPOSITORY_STRUCTURE_EXECUTION_PLAN.md](REPOSITORY_STRUCTURE_EXECUTION_PLAN.md)