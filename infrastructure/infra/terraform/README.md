# Terraform Infrastructure

Canonical shared Terraform assets belong in this directory.

## Expected Module Surface

The minimum Azure production module set for COREVIA is:

- `acr/` for Azure Container Registry
- `aks/` for the Kubernetes cluster and node pools
- `postgres/` for Azure Database for PostgreSQL
- `redis/` for Azure Cache for Redis
- `network/` for VNets, subnets, routing, and NSG rules
- `observability/` for diagnostics, metrics export, and log forwarding

## State And Promotion Rules

- Use remote state.
- Separate state per environment.
- Do not share mutable production state with staging.
- Pin provider versions and review plans before apply.

## Deployment Contract

Terraform should output or document the values required by the Helm production chart:

- ACR login server
- AKS namespace and ingress class
- PostgreSQL connection details or secret references
- Redis connection details or secret references
- public hostname for ingress and `ALLOWED_ORIGINS`

## Tomorrow Constraint

This workspace does not yet include live `.tf` modules. That means Azure infrastructure provisioning is still an operator task, not a reproducible code path. Use this directory for the post-release hardening work if the release proceeds on pre-provisioned Azure infrastructure.