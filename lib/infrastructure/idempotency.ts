import { IdempotencyRecord } from '../domain/types';

export class IdempotencyManager {
  private static store: Map<string, IdempotencyRecord> = new Map();

  /**
   * Check if a request has already been executed
   */
  public static get(key: string): IdempotencyRecord | undefined {
    const record = this.store.get(key);
    if (!record) return undefined;
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return record;
  }

  /**
   * Acquire execution lock for an idempotency key
   */
  public static acquire(key: string, ttlMs = 15 * 60 * 1000): { acquired: boolean; existingRecord?: IdempotencyRecord } {
    const existing = this.get(key);
    if (existing) {
      return { acquired: false, existingRecord: existing };
    }

    const newRecord: IdempotencyRecord = {
      idempotencyKey: key,
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };

    this.store.set(key, newRecord);
    return { acquired: true, existingRecord: newRecord };
  }

  /**
   * Commit result payload to idempotency record
   */
  public static commit(key: string, responsePayload: any): void {
    const record = this.get(key);
    if (record) {
      record.status = 'COMMITTED';
      record.responsePayload = responsePayload;
      this.store.set(key, record);
    }
  }

  /**
   * Mark execution as failed so subsequent retries can proceed
   */
  public static fail(key: string): void {
    this.store.delete(key);
  }
}
