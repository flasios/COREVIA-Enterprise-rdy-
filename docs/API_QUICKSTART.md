# API Quick Start Guide

## Prerequisites

- An active COREVIA account with appropriate role/permissions
- `curl` or a REST client (Postman, Insomnia)

## Authentication

COREVIA uses **session-based authentication** with HttpOnly cookies. All API calls (except login) require an authenticated session.

### 1. Login

```bash
# Replace with your credentials
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username": "your-username", "password": "your-password"}'
```

Response:
```json
{
  "user": {
    "id": 1,
    "username": "your-username",
    "role": "department_head",
    "permissions": ["demand.create", "demand.view", ...]
  }
}
```

### 2. CSRF Token

State-changing requests (POST, PUT, PATCH, DELETE) require a CSRF token:

```bash
# The CSRF token is returned as a cookie and must be sent as a header
curl http://localhost:5000/api/auth/session \
  -b cookies.txt \
  -c cookies.txt

# Use the x-csrf-token cookie value in the X-CSRF-Token header
```

### 3. All Subsequent Requests

```bash
curl http://localhost:5000/api/demands \
  -b cookies.txt \
  -H "X-CSRF-Token: <csrf-token>"
```

---

## Core Workflows

### Create a Demand

```bash
curl -X POST http://localhost:5000/api/demands \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <csrf-token>" \
  -d '{
    "title": "New CRM System",
    "description": "Enterprise CRM for customer management",
    "type": "new_system",
    "priority": "high",
    "businessJustification": "Current system EOL in 6 months",
    "requestedBudget": 500000,
    "requestedTimeline": "2025-Q3"
  }'
```

### Get All Demands

```bash
curl http://localhost:5000/api/demands \
  -b cookies.txt
```

### Submit Demand for Review

```bash
curl -X POST http://localhost:5000/api/demands/1/submit \
  -b cookies.txt \
  -H "X-CSRF-Token: <csrf-token>"
```

### Version Workflow

Versions follow the state machine: `draft → under_review → approved → manager_approval → published`

```bash
# Create a new version (draft)
curl -X POST http://localhost:5000/api/demands/1/versions \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <csrf-token>" \
  -d '{"sections": { ... }}'

# Submit version for review
curl -X POST http://localhost:5000/api/demands/1/versions/v1/submit \
  -b cookies.txt \
  -H "X-CSRF-Token: <csrf-token>"

# Approve version
curl -X POST http://localhost:5000/api/demands/1/versions/v1/approve \
  -b cookies.txt \
  -H "X-CSRF-Token: <csrf-token>"
```

### Projects

```bash
# List projects
curl http://localhost:5000/api/projects \
  -b cookies.txt

# Get project with workspace
curl http://localhost:5000/api/projects/1 \
  -b cookies.txt
```

### EA Registry

```bash
# List applications
curl http://localhost:5000/api/ea/registry/applications \
  -b cookies.txt

# List technology standards
curl http://localhost:5000/api/ea/registry/technology-standards \
  -b cookies.txt

# List data domains
curl http://localhost:5000/api/ea/registry/data-domains \
  -b cookies.txt
```

---

## Rate Limits

| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| `/api/*` (general) | 100 req | 15 min |
| `/api/auth/*` | 10 req | 15 min |
| `/api/ai/*`, `/api/brain/*` | 10 req | 1 min |
| Upload endpoints | 50 req | 1 hour |
| Admin mutations | 20 req | 15 min |

---

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": { }  // Optional validation details
}
```

| Status | Meaning |
|--------|---------|
| 400 | Invalid request body / validation error |
| 401 | Not authenticated |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g., version state transition not allowed) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Interactive Documentation

Swagger UI is available at: `http://localhost:5000/api-docs`

OpenAPI JSON spec: `http://localhost:5000/api-docs.json`
