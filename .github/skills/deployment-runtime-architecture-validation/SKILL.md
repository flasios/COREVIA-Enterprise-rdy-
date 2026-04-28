---
name: deployment-runtime-architecture-validation
description: 'Validate COREVIA deployment and runtime architecture using implementation evidence. Use for Docker image packaging checks, runtime topology review, environment contract validation, health/readiness verification, release gating, rollback readiness, and deployment conformance analysis.'
argument-hint: 'What deployment or runtime architecture should be validated?'
user-invocable: true
---

# Deployment Runtime Architecture Validation

Use this skill to validate whether COREVIA's runtime packaging, deployment topology, environment contract, and operational controls match the intended architecture and can actually boot, serve, and recover.

## When to Use
- Review Docker, Compose, or Kubernetes runtime architecture.
- Validate image packaging, startup prerequisites, and static/runtime asset completeness.
- Assess environment variables, secrets, ports, health checks, and dependency wiring.
- Verify release readiness, rollback readiness, and deployment gate coverage.
- Investigate runtime conformance issues where docs and actual deployment behavior differ.

## Default Operating Pattern
1. Define the exact runtime surface being validated.
2. Read the canonical deployment docs and manifests before drawing conclusions.
3. Verify packaging, startup, dependency connectivity, and health behavior with evidence.
4. Distinguish blocking defects from non-blocking warnings.
5. End with concrete remediation steps and validation commands.

## Primary Evidence Sources
- `infrastructure/docker/api.Dockerfile`
- `infrastructure/docker/docker-compose.yml`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/K8S_DEPLOYMENT.md`
- `docs/RELEASE_RUNBOOK.md`
- `docs/ROLLBACK_RUNBOOK.md`
- `docs/STAGING_SMOKE_GATE.md`
- `.devcontainer/devcontainer.json`
- startup and health code in `server/` and `apps/api/`

## Procedure

### 1. Frame the Validation Target
- Identify the runtime or deployment unit: image, container, compose stack, k8s workload, or release flow.
- Define the expected outcome: build success, boot success, health success, topology conformance, or rollout readiness.

### 2. Inspect the Declared Architecture
- Read the deployment docs and manifests that define the intended runtime.
- Note expected ports, dependencies, environment variables, health endpoints, and deployment boundaries.
- Identify whether the system is intended to run as a monolith, modular monolith, or multiple deployable runtimes.

### 3. Verify Packaging Completeness
- Check that Dockerfiles and build scripts produce all runtime-required artifacts.
- Confirm that server bundles, client assets, generated files, and static content land in the paths expected by runtime code.
- Verify that production builds do not rely on dev-only dependencies or local-only paths.

### 4. Verify Environment and Dependency Contracts
- Identify required environment variables versus optional integrations.
- Check database, cache, queue, storage, and third-party service assumptions.
- Distinguish hard startup gates from warnings that degrade features without blocking boot.

### 5. Exercise the Runtime
- Build or inspect the artifact using the canonical commands.
- Start the runtime with the minimum viable environment needed for validation.
- Check logs, health endpoints, container status, and exposed ports.
- If dependencies are required, validate connectivity through the actual network topology.

### 6. Classify Findings
- blocking packaging defect
- startup contract defect
- dependency wiring defect
- environment or secret contract defect
- documentation drift
- operational readiness gap

### 7. Recommend the Smallest Correct Fix
- Prefer fixes at the packaging or contract layer instead of adding brittle runtime workarounds.
- If docs are wrong, update docs.
- If manifests are wrong, update manifests.
- If build artifacts are incomplete, fix the build pipeline.
- If validation succeeded, summarize the exact prerequisites required for success.

## Quality Criteria
- Findings are backed by build output, manifests, logs, code, or health probes.
- The skill distinguishes current runtime fact from intended deployment design.
- Recommendations are executable and verifiable.
- Blocking issues are clearly separated from optional integration warnings.
- The final output includes both remediation and a verification path.

## Completion Checks
- The validated runtime surface is named explicitly.
- Packaging and startup assumptions were checked, not guessed.
- Required environment variables and dependencies are identified.
- Health or readiness behavior is verified where feasible.
- The response ends with either a confirmed pass or a concrete defect list with next steps.

## Example Prompts
- `/deployment-runtime-architecture-validation Validate whether the current Docker image packaging is sufficient for production startup.`
- `/deployment-runtime-architecture-validation Review the Compose topology against the documented deployment architecture and identify drift.`
- `/deployment-runtime-architecture-validation Check whether COREVIA's runtime env contract is fully documented and enforced.`
- `/deployment-runtime-architecture-validation Assess release and rollback readiness for the current deployment surface.`