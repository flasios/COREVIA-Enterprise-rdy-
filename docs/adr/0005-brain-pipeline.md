# ADR-0005: 8-Layer COREVIA Brain Pipeline

> **Status:** accepted
>
> **Date:** 2025-02-10
>
> **Deciders:** Platform Architecture Team

## Context

The COREVIA platform uses AI (LLMs) extensively for demand analysis, business case generation, EA assessment, strategic fit evaluation, and decision intelligence. We needed an architecture that:

1. Provides governance guardrails over AI outputs (not raw LLM responses)
2. Supports human-in-the-loop (HITL) approval gates
3. Enables per-layer runtime configuration (enable/disable, timeout, retry, SLA)
4. Enforces data sovereignty requirements (UAE government — no data leaves sovereign infrastructure)
5. Supports multiple AI providers with failover

## Decision

We implemented an **8-layer processing pipeline** (the "COREVIA Brain"):

| Layer | Name | Responsibility |
|-------|------|----------------|
| L1 | Intake | Parse and normalize input demands |
| L2 | Classification | Categorize demand type, priority, complexity |
| L3 | PolicyOps | Apply governance policy packs, compliance rules |
| L4 | Context | Retrieve context via RAG (pgvector knowledge base) |
| L5 | Orchestration | Route to appropriate intelligence engine |
| L6 | Reasoning | LLM inference with structured prompting |
| L7 | Validation | Authority validation, HITL approval gates |
| L8 | Memory | Store results, update decision spine, emit events |

Each layer is independently configurable via a **Control Plane**:
- Enable/disable per layer
- SLA timeout per layer
- Retry policy per layer
- Approval-required flag (for HITL)
- Policy mode: enforce / monitor / bypass

## Consequences

### Positive

- AI governance is baked into the architecture, not bolted on
- HITL gates at Layer 7 ensure no AI decision is auto-approved without human review
- Data sovereignty: Layer 5 routes to "Internal" engine (sovereign Falcon-40B) vs "Hybrid" (Anthropic) based on data classification
- Each layer can be independently monitored, tuned, or disabled
- The pipeline pattern makes it trivial to add new processing stages

### Negative

- 8 layers add latency compared to direct LLM calls (~2-5s overhead per demand analysis)
- Complexity: debugging requires understanding cross-layer data flow
- The control plane is powerful but could be misconfigured (e.g., disabling all layers)

### Neutral

- RAG at Layer 4 uses pgvector (see ADR-0010) — trades external vector DB for simplicity
- Memory at Layer 8 feeds back into the Decision Spine state machine
