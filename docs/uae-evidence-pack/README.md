# UAE Government Evidence Pack

This folder is a deployment-ready evidence workspace for UAE government onboarding and audits.

## Purpose
- Keep all compliance and security evidence in one place.
- Track ownership, approval, and freshness for each artifact.
- Produce a repeatable sign-off package per release.

## What To Fill
1. Update `docs/uae-evidence-pack/evidence-register.csv` with real artifact paths and owners.
2. Complete `docs/uae-evidence-pack/control-mapping-template.md` with authority-specific controls.
3. Complete `docs/uae-evidence-pack/signoff-template.md` for each production go-live.
4. Store linked artifacts in your secure document repository and reference those paths in the register.

## Recommended Cadence
- Security test evidence: every release.
- Access review and privileged account attestation: quarterly.
- DR and incident tabletop evidence: at least annually.

## Classification Guidance
- Treat this pack as `Confidential` by default.
- Do not store secrets in plaintext inside this repository.
- Keep signed approvals in a controlled records system and link them in the register.
