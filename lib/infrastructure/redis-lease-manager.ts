import { Redis } from '@upstash/redis';
import { TableHoldLease } from '../domain/types';

interface InMemoryEntry<T> {
  value: T;
  expiresAt: number;
}

export class RedisLeaseManager {
  private static redisClient: Redis | null = null;
  private static isInitialized = false;
  private static useFallback = false;

  // In-memory fallback stores
  private static memoryStore: Map<string, InMemoryEntry<any>> = new Map();

  /**
   * Initialize or retrieve the Redis client
   */
  private static getClient(): Redis | null {
    if (this.isInitialized) {
      return this.useFallback ? null : this.redisClient;
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token && !url.includes('example.upstash.io')) {
      try {
        this.redisClient = new Redis({ url, token });
        this.useFallback = false;
        console.log('[RedisLeaseManager] Connected to Upstash Redis REST API.');
      } catch (err) {
        console.warn('[RedisLeaseManager] Failed to connect to Upstash Redis, falling back to in-memory:', err);
        this.useFallback = true;
      }
    } else {
      this.useFallback = true;
      console.log('[RedisLeaseManager] Upstash Redis credentials not configured. Operating in In-Memory Fallback mode.');
    }

    this.isInitialized = true;
    return this.useFallback ? null : this.redisClient;
  }

  /**
   * Clean expired entries from in-memory fallback
   */
  private static purgeExpiredMemory(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryStore.delete(key);
      }
    }
  }

  // Key generators
  private static getTableSlotKey(tenantId: string, tableId: string, date: string, time: string): string {
    return `lease:table:${tenantId}:${tableId}:${date}:${time}`;
  }

  private static getTokenKey(leaseToken: string): string {
    return `lease:token:${leaseToken}`;
  }

  /**
   * Check if a specific table slot is currently locked by a hold lease
   */
  public static async isTableSlotLocked(
    tenantId: string,
    tableId: string,
    date: string,
    time: string
  ): Promise<boolean> {
    const client = this.getClient();
    const key = this.getTableSlotKey(tenantId, tableId, date, time);

    if (client) {
      try {
        const exists = await client.exists(key);
        return exists === 1;
      } catch (err) {
        console.warn('[RedisLeaseManager] Redis exists check failed, checking memory:', err);
      }
    }

    this.purgeExpiredMemory();
    const entry = this.memoryStore.get(key);
    return !!entry && entry.expiresAt > Date.now();
  }

  /**
   * Create a 2-Phase Table Hold Lease with TTL (default: 600s / 10 minutes)
   */
  public static async createHoldLease(
    lease: TableHoldLease,
    ttlSeconds = 600
  ): Promise<{ success: boolean; message: string; lease?: TableHoldLease }> {
    const client = this.getClient();
    const slotKey = this.getTableSlotKey(lease.tenantId, lease.tableId, lease.date, lease.time);
    const tokenKey = this.getTokenKey(lease.leaseToken);

    // 1. Check if slot already locked
    const isLocked = await this.isTableSlotLocked(lease.tenantId, lease.tableId, lease.date, lease.time);
    if (isLocked) {
      return {
        success: false,
        message: `Meja ${lease.tableNumber} sedang dikunci sementara oleh reservasi lain. Silakan coba meja atau jam lain.`,
      };
    }

    const expiresAt = Date.now() + ttlSeconds * 1000;
    const leaseWithExpiry: TableHoldLease = {
      ...lease,
      expiresAt,
    };

    if (client) {
      try {
        // Atomic setnx on slotKey to prevent concurrent locks
        const setNxResult = await client.set(slotKey, lease.leaseToken, {
          nx: true,
          ex: ttlSeconds,
        });

        if (!setNxResult) {
          return {
            success: false,
            message: `Meja ${lease.tableNumber} baru saja dipesan oleh pelanggan lain. Silakan pilih meja lain.`,
          };
        }

        // Store lease details by token
        await client.set(tokenKey, JSON.stringify(leaseWithExpiry), { ex: ttlSeconds });

        return {
          success: true,
          message: `Slot Meja ${lease.tableNumber} (${lease.tableArea}) berhasil dikunci selama 10 menit (Upstash Redis).`,
          lease: leaseWithExpiry,
        };
      } catch (err) {
        console.warn('[RedisLeaseManager] Redis set failed, falling back to memory:', err);
      }
    }

    // In-memory fallback
    this.purgeExpiredMemory();
    if (this.memoryStore.has(slotKey) && this.memoryStore.get(slotKey)!.expiresAt > Date.now()) {
      return {
        success: false,
        message: `Meja ${lease.tableNumber} sedang dikunci sementara oleh pemesanan lain.`,
      };
    }

    this.memoryStore.set(slotKey, { value: lease.leaseToken, expiresAt });
    this.memoryStore.set(tokenKey, { value: leaseWithExpiry, expiresAt });

    return {
      success: true,
      message: `Slot Meja ${lease.tableNumber} (${lease.tableArea}) berhasil dikunci selama 10 menit.`,
      lease: leaseWithExpiry,
    };
  }

  /**
   * Get an active hold lease by token
   */
  public static async getHoldLease(leaseToken: string): Promise<TableHoldLease | null> {
    const client = this.getClient();
    const tokenKey = this.getTokenKey(leaseToken);

    if (client) {
      try {
        const raw = await client.get<string | TableHoldLease>(tokenKey);
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return parsed as TableHoldLease;
        }
        return null;
      } catch (err) {
        console.warn('[RedisLeaseManager] Redis get failed, checking memory:', err);
      }
    }

    this.purgeExpiredMemory();
    const entry = this.memoryStore.get(tokenKey);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value as TableHoldLease;
    }
    return null;
  }

  /**
   * Release hold lease (called when reservation is committed or cancelled)
   */
  public static async releaseHoldLease(leaseToken: string): Promise<boolean> {
    const client = this.getClient();
    const tokenKey = this.getTokenKey(leaseToken);

    // Retrieve lease first to find associated table slot key
    const lease = await this.getHoldLease(leaseToken);
    const slotKey = lease ? this.getTableSlotKey(lease.tenantId, lease.tableId, lease.date, lease.time) : null;

    if (client) {
      try {
        await client.del(tokenKey);
        if (slotKey) {
          await client.del(slotKey);
        }
        return true;
      } catch (err) {
        console.warn('[RedisLeaseManager] Redis delete failed:', err);
      }
    }

    this.memoryStore.delete(tokenKey);
    if (slotKey) {
      this.memoryStore.delete(slotKey);
    }
    return true;
  }

  /**
   * Get all active hold leases
   */
  public static async getAllActiveLeases(): Promise<TableHoldLease[]> {
    const client = this.getClient();
    const activeLeases: TableHoldLease[] = [];

    if (client) {
      try {
        const keys = await client.keys('lease:token:*');
        for (const k of keys) {
          const raw = await client.get<string | TableHoldLease>(k);
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            activeLeases.push(parsed as TableHoldLease);
          }
        }
        return activeLeases;
      } catch (err) {
        console.warn('[RedisLeaseManager] Redis keys failed, fallback to memory:', err);
      }
    }

    this.purgeExpiredMemory();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (key.startsWith('lease:token:') && entry.expiresAt > Date.now()) {
        activeLeases.push(entry.value as TableHoldLease);
      }
    }
    return activeLeases;
  }

  /**
   * Distributed Lock for concurrent customer sessions / tool execution
   */
  public static async acquireSessionLock(sessionId: string, ttlSeconds = 15): Promise<boolean> {
    const client = this.getClient();
    const lockKey = `lock:session:${sessionId}`;

    if (client) {
      try {
        const result = await client.set(lockKey, 'locked', { nx: true, ex: ttlSeconds });
        return result === 'OK';
      } catch {
        // Fallback to memory
      }
    }

    this.purgeExpiredMemory();
    if (this.memoryStore.has(lockKey) && this.memoryStore.get(lockKey)!.expiresAt > Date.now()) {
      return false;
    }
    this.memoryStore.set(lockKey, { value: 'locked', expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }

  /**
   * Release session lock
   */
  public static async releaseSessionLock(sessionId: string): Promise<void> {
    const client = this.getClient();
    const lockKey = `lock:session:${sessionId}`;

    if (client) {
      try {
        await client.del(lockKey);
        return;
      } catch {}
    }

    this.memoryStore.delete(lockKey);
  }
}
