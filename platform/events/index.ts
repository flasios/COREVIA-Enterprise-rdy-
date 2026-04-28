/**
 * Domain Event Bus — Cross-Module Communication
 *
 * Type-safe, in-process event bus for domain events.
 * Modules publish events; other modules subscribe to them.
 *
 * Design:
 *  - All events are defined in shared/primitives/events
 *  - Handlers run asynchronously; failures are logged, never propagate
 *  - Supports middleware (audit logging, metrics)
 *  - No external dependencies — pure TypeScript
 *
 * Usage:
 *   // In module bootstrap:
 *   eventBus.subscribe("demand.DemandApproved", async (event) => { ... });
 *
 *   // In use-case:
 *   eventBus.emit("demand.DemandApproved", { demandReportId }, { actorId });
 */

import { logger } from "../logging/Logger";
import type { AllDomainEvents } from "@shared/primitives/events";

// Merge the full event catalog into the registry
// This gives the event bus compile-time knowledge of every event type.
declare module "@platform/events" {
   
  interface DomainEventRegistry extends AllDomainEvents {}
}

// ── Core Types ─────────────────────────────────────────────────────

export interface DomainEvent<T extends string = string, P = unknown> {
  readonly type: T;
  readonly payload: P;
  readonly timestamp: Date;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly actorId?: string;
}

export type EventHandler<E extends DomainEvent> = (event: E) => Promise<void>;

export type EventMiddleware = (
  event: DomainEvent,
  next: () => Promise<void>,
) => Promise<void>;

// ── Event Registry (type-safe map from event name → payload) ──────

/**
 * Central registry of all domain events in the system.
 * Each module extends this via declaration merging.
 *
 * @example
 * declare module "@platform/events" {
 *   interface DomainEventRegistry {
 *     DemandApproved: { demandId: string; approvedBy: string };
 *   }
 * }
 */
export interface DomainEventRegistry {
  // Populated by module declarations — see shared/primitives/events.ts
}

export type RegisteredEvent<K extends keyof DomainEventRegistry> = DomainEvent<
  K & string,
  DomainEventRegistry[K]
>;

// ── Event Factory ──────────────────────────────────────────────────

export function createEvent<K extends keyof DomainEventRegistry>(
  type: K,
  payload: DomainEventRegistry[K],
  meta?: {
    correlationId?: string;
    causationId?: string;
    actorId?: string;
  },
): RegisteredEvent<K> {
  return {
    type,
    payload,
    timestamp: new Date(),
    ...meta,
  };
}

// ── Event Bus Implementation ───────────────────────────────────────

class DomainEventBus {
  private readonly handlers = new Map<string, Set<EventHandler<DomainEvent>>>();
  private middlewares: EventMiddleware[] = [];
  private _eventLog: DomainEvent[] = [];
  private readonly _maxLogSize = 1000;

  /**
   * Subscribe to a domain event type.
   * Returns an unsubscribe function.
   */
  subscribe<K extends keyof DomainEventRegistry>(
    type: K,
    handler: EventHandler<RegisteredEvent<K>>,
  ): () => void {
    const key = type as string;
    let handlerSet = this.handlers.get(key);
    if (!handlerSet) {
      handlerSet = new Set();
      this.handlers.set(key, handlerSet);
    }
    const wrappedHandler = handler as EventHandler<DomainEvent>;
    handlerSet.add(wrappedHandler);

    return () => {
      handlerSet.delete(wrappedHandler);
      if (handlerSet.size === 0) this.handlers.delete(key);
    };
  }

  /**
   * Register middleware that runs around every event dispatch.
   */
  use(middleware: EventMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Publish a domain event. All handlers run concurrently.
   * Handler failures are logged but never propagate.
   */
  async publish<K extends keyof DomainEventRegistry>(
    event: RegisteredEvent<K>,
  ): Promise<void> {
    // Append to event log (circular buffer)
    this._eventLog.push(event);
    if (this._eventLog.length > this._maxLogSize) {
      this._eventLog = this._eventLog.slice(-this._maxLogSize);
    }

    const handlers = this.handlers.get(event.type as string);
    if (!handlers || handlers.size === 0) return;

    const dispatch = async () => {
      const promises = Array.from(handlers).map(async (handler) => {
        try {
          await handler(event);
        } catch (err) {
          logger.error(
            `[EventBus] Handler failed for ${String(event.type)}:`,
            err,
          );
        }
      });
      await Promise.allSettled(promises);
    };

    // Run through middleware chain
    if (this.middlewares.length === 0) {
      await dispatch();
      return;
    }

    let idx = 0;
    const runMiddleware = async (): Promise<void> => {
      const mw = this.middlewares[idx];
      if (mw) {
        idx += 1;
        await mw(event, runMiddleware);
      } else {
        await dispatch();
      }
    };
    await runMiddleware();
  }

  /**
   * Convenience: create and publish in one call.
   */
  async emit<K extends keyof DomainEventRegistry>(
    type: K,
    payload: DomainEventRegistry[K],
    meta?: {
      correlationId?: string;
      causationId?: string;
      actorId?: string;
    },
  ): Promise<void> {
    await this.publish(createEvent(type, payload, meta));
  }

  /** Number of registered handler types. */
  get subscriberCount(): number {
    return this.handlers.size;
  }

  /** Recent event log (for diagnostics / testing). */
  get eventLog(): ReadonlyArray<DomainEvent> {
    return this._eventLog;
  }

  /** Get handler count for a specific event type. */
  handlerCount(type: keyof DomainEventRegistry): number {
    return this.handlers.get(type as string)?.size ?? 0;
  }

  /** Clear all handlers and middleware (for testing). */
  reset(): void {
    this.handlers.clear();
    this.middlewares = [];
    this._eventLog = [];
  }
}

// ── Singleton ──────────────────────────────────────────────────────

export const eventBus = new DomainEventBus();

// ── Audit Middleware ───────────────────────────────────────────────

/**
 * Built-in middleware that logs all events at debug level.
 */
export const auditMiddleware: EventMiddleware = async (event, next) => {
  logger.debug(
    `[EventBus] ${String(event.type)} | actor=${event.actorId ?? "system"} | corr=${event.correlationId ?? "-"}`,
  );
  await next();
};
