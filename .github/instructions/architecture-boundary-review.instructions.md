---
applyTo: '{domains,platform,server}/**/*'
description: 'Architecture boundary review for COREVIA domain, platform, and server files. Use when editing or reviewing these layers to enforce ownership boundaries, canonical entrypoints, and implementation conformance.'
---

# Architecture Boundary Review

When working in `domains/`, `platform/`, or `server/`, treat boundary integrity as a first-class requirement.

## Review Goals
- Preserve the intended separation between domain, application, infrastructure, and API concerns.
- Prefer canonical entrypoints and public barrels over deep internal imports.
- Avoid changes that increase legacy coupling or blur ownership.
- Align new code with the repository's target source structure and architecture guidance.

## Required Checks
1. Identify the layer and owning module before editing.
2. Check whether imports cross boundaries through internal paths instead of public entrypoints.
3. Verify that domain code does not pull in framework, transport, database, queue, or filesystem concerns directly unless the existing architecture explicitly allows it.
4. Verify that API and application code do not bypass module/application boundaries to reach infrastructure or deep internal services directly.
5. Prefer `@domains/*`, `@platform/*`, and other canonical entrypoints over legacy paths when available.
6. If a requested change would deepen an architectural violation, either redirect it to the proper layer or call out the tradeoff explicitly.

## Decision Rules
- Prefer the smallest change that restores or preserves boundary clarity.
- If existing code already violates the target architecture, do not spread the pattern further.
- If a full refactor is out of scope, isolate the new change and note the remaining debt clearly.
- Treat code as the source of truth for current state and architecture docs as the source of truth for intended direction.

## Key References
- `docs/SOURCE_STRUCTURE_TARGET.md`
- `docs/ARCHITECTURE.md`
- `docs/COREVIA_ARCHITECTURE_CONFORMANCE_CHECKLIST_2026-03-10.md`
- `docs/COREVIA_ARCHITECTURE_CONFORMANCE_EXECUTION_PLAN_2026-03-10.md`
- repository import restrictions and boundary rules in `eslint.config.js`

## Review Output Expectations
- Call out boundary violations before discussing style or minor refactors.
- When making changes, mention the architectural reason for the chosen layer or import path.
- If no architecture issue is found, say so explicitly and mention any residual risk or debt nearby.
