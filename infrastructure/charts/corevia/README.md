# COREVIA Helm Chart

Canonical Helm assets live here.

## Runtime Model

- Deploy the API and processing worker as separate images.
- Use the API image for the main deployment.
- Use the processing-worker image for the worker deployment.
- Keep PostgreSQL and Redis external to the chart unless an environment explicitly owns those stateful services.

## Production Contract

Before rendering or installing the chart for production, validate the effective production values:

```bash
npm run validate:production-values
```

This checks the merged `values.yaml` + `values-production.yaml` contract for:

- immutable non-placeholder image references for both runtimes
- production security settings required by the API runtime
- an external Kubernetes Secret name or explicitly managed chart secret values
- a dedicated worker image when `worker.enabled=true`

For production, prefer `secret.create=false` and provide `secret.existingSecretName` from External Secrets, Sealed Secrets, or another secret manager integration.

## Azure Example

For AKS with Azure Container Registry, set production values like this:

```yaml
image:
	repository: myregistry.azurecr.io/corevia/api
	tag: 2026.04.20-sha-abc1234

worker:
	enabled: true
	image:
		repository: myregistry.azurecr.io/corevia/processing-worker
		tag: 2026.04.20-sha-abc1234
```

Then validate and render:

```bash
npm run validate:production-values
helm template corevia infrastructure/charts/corevia -f infrastructure/charts/corevia/values-production.yaml
```