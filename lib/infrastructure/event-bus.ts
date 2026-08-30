import { TenantId } from '../domain/types';

export type DomainEventType =
  | 'reservation.created'
  | 'reservation.updated'
  | 'reservation.cancelled'
  | 'inventory.updated'
  | 'order.created'
  | 'restaurant.status.changed'
  | 'human.handoff.requested';

export interface DomainEvent<T = any> {
  eventId: string;
  eventType: DomainEventType;
  tenantId: TenantId;
  timestamp: string;
  traceId?: string;
  payload: T;
}

export type EventHandler<T = any> = (event: DomainEvent<T>) => void | Promise<void>;

export class DomainEventBus {
  private static handlers: Map<DomainEventType, Set<EventHandler>> = new Map();

  /**
   * Subscribe a listener to a domain event type
   */
  public static subscribe<T = any>(eventType: DomainEventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler);
    };
  }

  /**
   * Publish a domain event asynchronously to all subscribed listeners
   */
  public static publish<T = any>(event: Omit<DomainEvent<T>, 'eventId' | 'timestamp'> & { eventId?: string; timestamp?: string }): DomainEvent<T> {
    const fullEvent: DomainEvent<T> = {
      eventId: event.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: event.timestamp || new Date().toISOString(),
      eventType: event.eventType,
      tenantId: event.tenantId,
      traceId: event.traceId,
      payload: event.payload,
    };

    const listeners = this.handlers.get(event.eventType);
    if (listeners) {
      listeners.forEach((handler) => {
        try {
          handler(fullEvent);
        } catch (err) {
          console.error(`[EventBus Error] Failed handling ${event.eventType}:`, err);
        }
      });
    }

    return fullEvent;
  }
}
