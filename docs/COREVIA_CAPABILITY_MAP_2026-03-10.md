# COREVIA Capability Map

Date: 2026-03-10
Purpose: Define the founder-level capability hierarchy for COREVIA so product, engineering, architecture, and governance decisions align to one enterprise map.

## 1. Mapping Principles

This capability map is organized using three levels:

- L1: Enterprise capability domain
- L2: Core business/platform capability
- L3: Concrete capability slices that can be owned, funded, governed, and measured

The map is based on the current bounded-context structure, the COREVIA Brain model, and the actual workspace/product surface in the repository.

## 2. L1 Capability Landscape

1. Demand and Decision Initiation
2. Decision Governance and Control
3. Enterprise Architecture and Standards Governance
4. Portfolio, PMO, and Execution Control
5. Knowledge, Evidence, and Retrieval
6. Intelligence, Reasoning, and Learning
7. Integration and Interoperability
8. Platform Trust, Security, and Operations

## 3. Capability Map

## 3.1 Demand and Decision Initiation

### L2 Capabilities

- Demand Intake Management
- Demand Analysis and Artifact Generation
- Requirements and Strategic Fit Management
- Demand Versioning and Approval Readiness

### L3 Capabilities

| L2 Capability | L3 Capability | Current Module Alignment |
| --- | --- | --- |
| Demand Intake Management | Demand submission | Demand |
| Demand Intake Management | Demand normalization and classification handoff | Demand + Brain |
| Demand Intake Management | Intake routing and workspace entry | Demand + Portfolio UI |
| Demand Analysis and Artifact Generation | Business case generation | Demand + Brain |
| Demand Analysis and Artifact Generation | Requirements generation | Demand + Brain |
| Demand Analysis and Artifact Generation | Strategic fit generation | Demand + Brain |
| Requirements and Strategic Fit Management | Requirements editing and refinement | Demand |
| Requirements and Strategic Fit Management | Strategic fit review | Demand |
| Demand Versioning and Approval Readiness | Version creation and comparison | Demand + Versioning |
| Demand Versioning and Approval Readiness | Submit / approve / publish workflow | Demand + Governance |

## 3.2 Decision Governance and Control

### L2 Capabilities

- Decision Spine Management
- Approval and HITL Governance
- Policy and Control Enforcement
- Gate and Tender Governance

### L3 Capabilities

| L2 Capability | L3 Capability | Current Module Alignment |
| --- | --- | --- |
| Decision Spine Management | Decision state orchestration | Brain |
| Decision Spine Management | Sub-decision and artifact lineage | Brain |
| Approval and HITL Governance | Human review checkpoints | Brain + Governance |
| Approval and HITL Governance | Approval recording | Governance + Demand |
| Policy and Control Enforcement | Classification-driven control enforcement | Brain |
| Policy and Control Enforcement | Policy pack execution | Compliance + Brain |
| Gate and Tender Governance | Phase / gate workflow | Governance + Portfolio |
| Gate and Tender Governance | Tender and vendor governance | Governance |

## 3.3 Enterprise Architecture and Standards Governance

### L2 Capabilities

- Capability Architecture
- Application and Integration Architecture
- Data and Information Architecture
- Technology and Standards Governance

### L3 Capabilities

| L2 Capability | L3 Capability | Current Module Alignment |
| --- | --- | --- |
| Capability Architecture | Capability domain modeling | EA |
| Capability Architecture | Capability gap and strategic alignment analysis | EA + Brain |
| Application and Integration Architecture | Application registry | EA |
| Application and Integration Architecture | Interface and integration inventory | EA + Integration |
| Data and Information Architecture | Data domain registry | EA |
| Data and Information Architecture | Information classification and governance linkage | EA + Compliance |
| Technology and Standards Governance | Technology standards registry | EA |
| Technology and Standards Governance | Reference architecture guidance | EA |

## 3.4 Portfolio, PMO, and Execution Control

### L2 Capabilities

- Portfolio Planning and Prioritization
- Project Conversion and Structuring
- PMO Governance and Control
- Execution and Phase Management

### L3 Capabilities

| L2 Capability | L3 Capability | Current Module Alignment |
| --- | --- | --- |
| Portfolio Planning and Prioritization | Portfolio dashboarding | Portfolio |
| Portfolio Planning and Prioritization | Demand-to-project prioritization | Portfolio + Demand |
| Project Conversion and Structuring | Approved demand conversion to project | Portfolio + Governance |
| Project Conversion and Structuring | Workspace and project scaffold generation | Portfolio + Workspace |
| PMO Governance and Control | PMO office governance views | Portfolio / PMO |
| PMO Governance and Control | Governance demand intake visibility | PMO + Demand |
| Execution and Phase Management | Phase plans and milestone control | Portfolio Workspace |
| Execution and Phase Management | Risks, costs, procurement, deliverables, and status tracking | Portfolio Workspace |

## 3.5 Knowledge, Evidence, and Retrieval

### L2 Capabilities

- Document Intake and Extraction
- Knowledge Retrieval and RAG
- Evidence and Reference Management
- Knowledge Publishing and Reuse

### L3 Capabilities

| L2 Capability | L3 Capability | Current Module Alignment |
| --- | --- | --- |
| Document Intake and Extraction | Document upload and extraction | Knowledge |
| Document Intake and Extraction | OCR and structured extraction | Knowledge |
| Knowledge Retrieval and RAG | Chunking and embeddings | Knowledge |
| Knowledge Retrieval and RAG | Retrieval, reranking, and conversational memory | Knowledge |
| Evidence and Reference Management | Evidence association with decisions and reports | Knowledge + Compliance |
| Evidence and Reference Management | Citation and provenance support | Knowledge + Brain |
| Knowledge Publishing and Reuse | Export and generated briefing outputs | Knowledge |
| Knowledge Publishing and Reuse | Reusable knowledge agent flows | Knowledge + Intelligence |

## 3.6 Intelligence, Reasoning, and Learning

### L2 Capabilities

- Decision Orchestration
- Controlled Reasoning
- Market and Strategic Intelligence
- Institutional Learning

### L3 Capabilities

| L2 Capability | L3 Capability | Current Module Alignment |
| --- | --- | --- |
| Decision Orchestration | Layer 1-8 orchestration | Brain |
| Decision Orchestration | Engine routing and intelligence plan generation | Brain |
| Controlled Reasoning | Draft artifact generation | Brain |
| Controlled Reasoning | Validation and risk / bias checks | Brain |
| Market and Strategic Intelligence | Market research generation | Intelligence + Demand |
| Market and Strategic Intelligence | Proactive insights and recommendations | Intelligence |
| Institutional Learning | Approved-outcome feedback capture | Intelligence + Brain |
| Institutional Learning | Learning pattern and memory maintenance | Intelligence |

## 3.7 Integration and Interoperability

### L2 Capabilities

- Connector Management
- External Workflow Integration
- Data Exchange and Interop Contracts
- Event and Notification Integration

### L3 Capabilities

| L2 Capability | L3 Capability | Current Module Alignment |
| --- | --- | --- |
| Connector Management | Connector registry and templates | Integration |
| Connector Management | Connector runtime orchestration | Integration |
| External Workflow Integration | External system handoff | Integration + Portfolio |
| External Workflow Integration | Identity / directory / messaging adapters | Integration + Identity |
| Data Exchange and Interop Contracts | Schema and payload discipline | Shared Contracts + Integration |
| Data Exchange and Interop Contracts | API and event alignment | Integration + Platform |
| Event and Notification Integration | Triggered notifications | Notifications |
| Event and Notification Integration | Delivery tracking | Notifications |

## 3.8 Platform Trust, Security, and Operations

### L2 Capabilities

- Identity and Access Control
- Security and Compliance Operations
- Runtime Operations and Observability
- Release and Platform Governance

### L3 Capabilities

| L2 Capability | L3 Capability | Current Module Alignment |
| --- | --- | --- |
| Identity and Access Control | Session management and RBAC | Identity + Operations |
| Identity and Access Control | Permission enforcement in UI and API | Identity + Shared UI/Auth |
| Security and Compliance Operations | CSRF, CSP, rate limiting, and secure middleware | Platform + Server Middleware |
| Security and Compliance Operations | Policy packs and compliance checks | Compliance |
| Runtime Operations and Observability | Logging, metrics, health, tracing hooks | Platform |
| Runtime Operations and Observability | Control-plane diagnostics | Operations |
| Release and Platform Governance | Quality gates and architecture boundary enforcement | Platform + Scripts |
| Release and Platform Governance | IaC / charts / deployment governance | Infra + Charts |

## 4. Capability Ownership View

| Capability Domain | Primary Owner | Secondary Owners |
| --- | --- | --- |
| Demand and Decision Initiation | Demand | Brain, Governance, Portfolio |
| Decision Governance and Control | Brain + Governance | Compliance, Demand |
| Enterprise Architecture and Standards Governance | EA | Compliance, Integration, Intelligence |
| Portfolio, PMO, and Execution Control | Portfolio | Governance, Demand |
| Knowledge, Evidence, and Retrieval | Knowledge | Compliance, Intelligence |
| Intelligence, Reasoning, and Learning | Brain + Intelligence | Knowledge, Demand, EA |
| Integration and Interoperability | Integration | Identity, Notifications, Portfolio |
| Platform Trust, Security, and Operations | Identity + Operations + Platform | Compliance |

## 5. Current Maturity Reading

| Domain | Maturity | Reading |
| --- | --- | --- |
| Demand and Decision Initiation | Strong | Functionally broad and central to the platform |
| Decision Governance and Control | Strong but still consolidating | Strategic differentiator, must keep tightening invariants |
| Enterprise Architecture and Standards Governance | Promising | Strong model direction, needs more operating-model depth |
| Portfolio, PMO, and Execution Control | Medium | Rich surface, but large-file and coherence debt remain |
| Knowledge, Evidence, and Retrieval | Medium-Strong | Important infrastructure in place |
| Intelligence, Reasoning, and Learning | Strong conceptually | Needs continued hardening and explainability discipline |
| Integration and Interoperability | Medium | Good structure, less visible operational maturity |
| Platform Trust, Security, and Operations | Medium-Strong | Good controls, still needs deeper production evidence and operating rigor |

## 6. Capability Gaps That Matter Most

1. Enterprise capability ownership is still stronger in code structure than in formal operating model.
2. Cross-capability value streams are implicit; they should become explicit executive artifacts.
3. PMO, EA, Governance, and Demand need tighter shared semantics for enterprise planning and control.
4. Read models and analytics views should be capability-aligned, not page-shaped.
5. Institutional learning is present architecturally, but still early as a measurable business capability.

## 7. Target Capability Priorities

Priority 1:

- Decision Governance and Control
- Demand and Decision Initiation
- Enterprise Architecture and Standards Governance

Priority 2:

- Portfolio, PMO, and Execution Control
- Knowledge, Evidence, and Retrieval

Priority 3:

- Intelligence, Reasoning, and Learning
- Integration and Interoperability
- Platform Trust, Security, and Operations

## 8. Final Capability Statement

COREVIA is not just a collection of modules. It is an enterprise capability platform whose center of gravity is governed decision-making. The capability map should be used as the reference model for funding priorities, bounded-context ownership, roadmap sequencing, KPI design, and architecture review.