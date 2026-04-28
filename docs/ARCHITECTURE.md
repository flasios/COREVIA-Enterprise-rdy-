# COREVIA Architecture Overview

See also: `docs/architecture/README.md` for the architecture landing zone, `docs/architecture/REPOSITORY_STRUCTURE_TRANSITION.md` for the current-to-target repository shape and transition guidance, and `docs/adr/0023-intelligent-workspace-mission-control-boundary.md` for the Intelligent Workspace ownership decision.

## System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                        │
│   TanStack Query · shadcn/ui · Tailwind CSS · Wouter               │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP / WebSocket
┌────────────────────────────▼────────────────────────────────────────┐
│                      Express Application Server                     │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │  Middleware   │  │   Domain Modules │  │   Platform Services   │ │
│  │  • Auth       │  │   • Demand       │  │   • Observability     │ │
│  │  • CSRF       │  │   • Portfolio    │  │   • Feature Flags     │ │
│  │  • Rate Limit │  │   • Governance   │  │   • Event Bus         │ │
│  │  • API Version│  │   • Intelligence │  │   • Cache (Redis)     │ │
│  │  • Metrics    │  │   • EA           │  │   • Queue (BullMQ)    │ │
│  │  • Tracing    │  │   • Knowledge    │  │   • Logging           │ │
│  └──────────────┘  │   • Operations   │  └───────────────────────┘ │
│                     │   • Compliance   │                            │
│                     │   • Integration  │                            │
│                     │   • Notifications│                            │
│                     │   • Identity     │                            │
│                     └──────────────────┘                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Storage Layer (Ports & Adapters)             ││
│  │  11 Port Interfaces → PostgresStorage Adapter → Drizzle ORM    ││
│  └─────────────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                  PostgreSQL 16 + pgvector                           │
│              153 tables · 11 migrations · RBAC                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Map

### Bounded Contexts And Control Plane (13)

| Module | Responsibility | Key Tables |
|--------|---------------|------------|
| **Demand** | Demand intake, classification, versioning | demands, demand_versions |
| **Portfolio** | Project lifecycle, WBS, execution tracking | projects, wbs_tasks, milestones |
| **Governance** | Gate reviews, tenders, vendor evaluation | gates, tenders, vendor_proposals |
| **Intelligence** | AI orchestration, analytics, RAG | ai_analyses, rag_chunks |
| **EA** | Enterprise Architecture registry & assessment | ea_applications, ea_standards, ea_data_domains |
| **Knowledge** | Document management, embeddings | knowledge_documents, knowledge_chunks |
| **Operations** | Users, organizations, audit | users, organizations, audit_logs |
| **Compliance** | Policy packs, regulatory checks | policy_packs, compliance_checks |
| **Integration** | External system connectors | connectors, connector_events |
| **Notifications** | Alerts, in-app notifications | notifications, notification_preferences |
| **Identity** | RBAC, sessions, permissions | sessions, role_permissions |
| **Workspace** | Human operating console, workspace aggregation, mission-control workflows | intelligent_workspaces |
| **Brain** | 8-layer AI governance pipeline | brain_layers, brain_executions |

### Experience Layer

| Experience | Responsibility |
|-----------|----------------|
| **Intelligent Workspace** | Enterprise mission control surface that answers what happened, what requires attention, what decision is needed, and what output must be produced |
| **Demand UI** | Demand intake, analysis, and conversion experience |
| **Portfolio UI** | Project and PMO execution experience |
| **Knowledge UI** | Document, graph, and briefing experience |

### Platform Services

| Service | Purpose |
|---------|---------|
| Observability | Prometheus metrics (`/metrics`), OpenTelemetry tracing |
| Feature Flags | DB-backed flags with role/org/environment targeting |
| Cache | Redis adapter with MemoryCache fallback |
| Event Bus | Type-safe in-process domain event dispatch |
| Queue | BullMQ for async processing (vendor proposals) |
| Logging | Structured JSON logging with correlation IDs |

## Data Flow: Demand → Project

```
User creates demand
       │
       ▼
┌──────────────────┐      ┌──────────────────┐
│  Demand Module   │─────▶│  Brain Pipeline   │
│  (intake + version)     │  (8-layer AI)     │
└──────────────────┘      └──────┬───────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Decision Spine          │
                    │  (state machine)         │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────▼──────────────────┐
              │  Gate Reviews (Governance Module)     │
              │  G0 → G1 → G2 → G3 → G4 → G5       │
              └──────────────────┬──────────────────┘
                                 │ (approved)
                    ┌────────────▼────────────┐
                    │  Project Creation        │
                    │  (Portfolio Module)       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Execution Tracking      │
                    │  WBS · Milestones · KPIs │
                    └─────────────────────────┘
```

## Data Flow: Intelligent Workspace

```
Decision Spine ───────┐
                      │
Knowledge Briefings ──┼────▶ Workspace Domain Aggregation ────▶ Intelligent Workspace UI
                      │                 │                       │
Knowledge Documents ──┤                 │                       ├──▶ Left Nav: operational modules
                      │                 │                       ├──▶ Center Canvas: brief, decision review, workflow builder
Brain Agent Runtime ──┘                 │                       └──▶ Right Rail: decisions, signals, context
                                        │
                                        └────▶ Agent workflow execution through governed Brain agents
```

- The Workspace bounded context is not a parallel control plane.
- It is the human operating console over existing COREVIA assets: Decision Spine, governance outcomes, knowledge context, and governed agent execution.
- The Workspace backend aggregates live system state and normalizes it for a mission-control UI instead of letting the browser orchestrate multiple platform calls directly.

## COREVIA Brain Pipeline (8 Layers)

```
Input Demand
    │
    ▼
┌───────────┐  ┌───────────────┐  ┌───────────┐  ┌──────────┐
│ L1 Intake │→ │ L2 Classify   │→ │ L3 Policy │→ │ L4 Context│
│ (parse)   │  │ (categorize)  │  │ (govern)  │  │ (RAG)    │
└───────────┘  └───────────────┘  └───────────┘  └──────────┘
                                                       │
┌───────────┐  ┌───────────────┐  ┌───────────┐  ┌────▼─────┐
│ L8 Memory │← │ L7 Validate   │← │ L6 Reason │← │L5 Orch.  │
│ (store)   │  │ (HITL gate)   │  │ (LLM)     │  │(route)   │
└───────────┘  └───────────────┘  └───────────┘  └──────────┘
```

## Storage Architecture

```
Modules ──▶ Port Interfaces ──▶ PostgresStorage ──▶ Repositories ──▶ Drizzle ORM ──▶ PostgreSQL

Example:
  DemandModule
    → IDemandStoragePort (interface)
      → PostgresStorage.getDemand() (adapter)
        → demandRepository.getDemand() (implementation)
          → db.select().from(demands).where(...) (Drizzle query)
```

### Port Interfaces (11)

- `IDemandStoragePort` — Demand CRUD, search, pipeline
- `IPortfolioStoragePort` — Projects, WBS, milestones, charters  
- `IGovernanceStoragePort` — Gates, tenders, vendors
- `IIntelligenceStoragePort` — AI analyses, patterns
- `IEaStoragePort` — EA registry, assessments
- `IKnowledgeStoragePort` — Documents, chunks, embeddings
- `IOperationsStoragePort` — Users, organizations, audit
- `IComplianceStoragePort` — Policy packs, checks
- `IVersioningStoragePort` — Cross-module versioning
- `IBrainStoragePort` — Brain pipeline state
- `IIdentityStoragePort` — Sessions, auth

## Security Architecture

- **Session-based auth** with HttpOnly/Secure/SameSite=Strict cookies
- **CSRF protection** on all state-changing requests
- **RBAC** with 17 roles and ~98 permissions
- **Rate limiting** — per-route limiters (AI, upload, auth, standard)
- **Content Security Policy** — strict CSP with report-only mode
- **Input validation** — Zod schemas on all endpoints
- **SQL injection** — prevented by Drizzle ORM parameterized queries
- **Data sovereignty** — all data stays within sovereign PostgreSQL instance

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript · Vite 5 · Tailwind 3 · shadcn/ui |
| State | TanStack Query (server state) · React Context (auth) |
| Routing | Wouter (client) · Express Router (server) |
| Backend | Express 4 · TypeScript · esbuild |
| Database | PostgreSQL 16 · pgvector · Drizzle ORM |
| Cache | Redis (ioredis) with MemoryCache fallback |
| Queue | BullMQ (Redis-backed) |
| Observability | Prometheus metrics · OpenTelemetry tracing |
| CI/CD | GitHub Actions · Docker · Helm · Terraform |
| Testing | Vitest · Playwright (planned) |
