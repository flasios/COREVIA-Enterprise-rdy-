# ADR-0009: In-Process Domain Event Bus Over External Message Broker

> **Status:** accepted
>
> **Date:** 2025-02-08
>
> **Deciders:** Platform Architecture Team

## Context

Cross-module communication is needed for scenarios like:
- When a demand is approved → notify portfolio module
- When EA is published → update strategic fit prerequisites
- When a gate is passed → update project status

We considered external message brokers (RabbitMQ, Kafka, NATS) vs. an in-process event bus.

## Decision

We implemented a **type-safe in-process event bus** with:

- Event declarations in `shared/primitives/events.ts` using TypeScript declaration merging
- `EventBus.emit(event, payload)` / `EventBus.on(event, handler)` API
- Middleware chain for cross-cutting concerns (audit logging, error handling)
- Synchronous in-process dispatch — no network serialization

## Consequences

### Positive

- Zero infrastructure dependency — no RabbitMQ/Kafka cluster to operate
- Type-safe: event names and payload shapes are compile-time checked
- Sub-millisecond dispatch latency (function call, not network hop)
- Middleware chain enables audit logging, error isolation, timing metrics
- Simple to test: mock the bus, assert events were emitted

### Negative

- Events are lost if the process crashes mid-dispatch (no persistence or replay)
- All handlers execute in the same process — a slow handler blocks the event loop
- Not suitable for inter-service communication when decomposing to microservices

### Neutral

- When migrating to microservices, the event bus interface can be re-implemented over NATS/Kafka without changing emitter/handler code
- BullMQ is available for durable async jobs; the event bus is for synchronous cross-module signals
