# Azure Infrastructure

This directory is the canonical landing zone for Azure-specific deployment assets for COREVIA.

## Target Azure Topology

- Azure Kubernetes Service for `api` and `processing-worker`
- Azure Container Registry for immutable runtime images
- Azure Database for PostgreSQL for application state
- Azure Cache for Redis for queues, sessions, and rate limiting
- Azure Key Vault or external secret injection for runtime secrets
- Application Gateway or NGINX ingress with TLS termination and forwarded headers

## Required Inputs Before Deployment

- Azure subscription and target resource group
- AKS cluster name and namespace
- ACR login server
- PostgreSQL hostname, database, username, and password source
- Redis hostname and credential source
- production origins for `ALLOWED_ORIGINS`
- strong `SESSION_SECRET`
- strong `METRICS_AUTH_TOKEN` unless metrics are restricted privately another way

## Canonical Release Flow

1. Build and push both runtime images to ACR.
2. Set immutable tags for both images.
3. Create or sync a Kubernetes Secret from Key Vault or your secret controller.
4. Populate `infrastructure/charts/corevia/values-production.yaml` with the ACR image repositories, release tag, and external secret name.
5. Run `npm run validate:production-values`.
6. Run `helm lint` and `helm template` against the production values.
7. Deploy to AKS and validate `/api/health`, `/api/health/ready`, `/metrics`, `/health`, and `/health/ready`.

## Minimal Azure Commands

```bash
az acr login --name <acr-name>
docker build -f infrastructure/docker/api.Dockerfile -t <acr-login-server>/corevia/api:<tag> .
docker build -f infrastructure/docker/worker.Dockerfile -t <acr-login-server>/corevia/processing-worker:<tag> .
docker push <acr-login-server>/corevia/api:<tag>
docker push <acr-login-server>/corevia/processing-worker:<tag>

npm run validate:production-values
helm template corevia infrastructure/charts/corevia -f infrastructure/charts/corevia/values-production.yaml
helm upgrade --install corevia infrastructure/charts/corevia -n corevia --create-namespace -f infrastructure/charts/corevia/values-production.yaml
```

## Current Gap

Terraform for Azure infrastructure provisioning is not implemented yet in this workspace. If tomorrow's deployment depends on new Azure infrastructure creation, provision those resources before the release window or add the missing IaC under `infrastructure/infra/terraform/`.