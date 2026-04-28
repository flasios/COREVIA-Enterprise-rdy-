# API Versioning Policy

## Overview

COREVIA uses **URL-based API versioning** with optional header-based negotiation. All API endpoints are served under a versioned prefix (`/api/v1/`).

## Version Format

Versions follow the pattern `v{major}` — only major version changes are reflected in the URL. Minor and patch changes are backwards-compatible and do not require a new version prefix.

```
/api/v1/demands        ← Current stable version
/api/v2/demands        ← Future version (when breaking changes are needed)
```

## How to Use

### URL-Based (Recommended)

```bash
# Explicitly use version 1
curl http://localhost:5000/api/v1/demands

# Legacy unversioned URLs still work (mapped to latest stable version)
curl http://localhost:5000/api/demands
```

### Header-Based (Alternative)

```bash
# Request a specific version via header
curl http://localhost:5000/api/demands \
  -H "API-Version: 1"
```

## Deprecation Policy

When a new API version is introduced:

1. **Deprecation Notice** — The old version returns a `Deprecation` header:
   ```
   Deprecation: true
   Sunset: 2026-01-01T00:00:00Z
   Link: <https://docs.corevia.ae/api/v2>; rel="successor-version"
   ```

2. **6-Month Sunset Window** — The deprecated version continues working for 6 months after the successor is released.

3. **Sunset** — After the sunset date, the old version returns `410 Gone`.

## Versioning Rules

| Change Type | Version Impact | Example |
|------------|---------------|---------|
| New endpoint | None (additive) | `POST /api/v1/new-resource` |
| New optional field | None (additive) | Adding `metadata` field to response |
| Field rename | Major bump | `requestedBudget` → `budget` |
| Field removal | Major bump | Removing `legacyField` |
| Behavior change | Major bump | Changing validation rules |
| Status code change | Major bump | `200 → 201` for POST |

## Current Versions

| Version | Status | Sunset Date |
|---------|--------|-------------|
| `v1` | **Active** | — |

## Implementation Details

The versioning middleware (`interfaces/middleware/apiVersion.ts`):

1. Extracts version from URL path (`/api/v1/...`) or `API-Version` header
2. Rewrites the request path (strips `/v1/` prefix) for downstream routing
3. Attaches `req.apiVersion` for route handlers to inspect
4. Adds deprecation/sunset headers for deprecated versions
5. Provides `requireApiVersion(minVersion)` guard for version-gated features

## Feature Flags + Versioning

New features can be rolled out behind feature flags before being promoted to a new API version:

```typescript
// Feature available only when flag is enabled (any version)
router.get("/experimental-endpoint",
  requireFeatureFlag("experimental-endpoint"),
  handler
);

// Feature available in v2+ only
router.get("/v2-endpoint",
  requireApiVersion(2),
  handler
);
```
