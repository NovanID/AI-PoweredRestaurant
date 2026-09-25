import {
  Reservation,
  Table,
  TableArea,
  TableHoldLease,
  TenantId,
  ReservationStatus,
} from './types';
import { restaurantStore } from '../restaurant-store';
import { BusinessRuleEngine } from './business-rules';

import { RedisLeaseManager } from '../infrastructure/redis-lease-manager';

export interface AvailabilityResult {
  available: boolean;
  availableTables: Table[];
  reason?: string;
}

export class ReservationService {
  /**
   * Helper: check if two time slots overlap (assuming standard 90 mins slot)
   */
  private static isTimeOverlap(timeA: string, timeB: string, durationMinutes = 90): boolean {
    const [hA, mA] = timeA.split(':').map(Number);
    const [hB, mB] = timeB.split(':').map(Number);
    const minA = hA * 60 + (mA || 0);
    const minB = hB * 60 + (mB || 0);
    return Math.abs(minA - minB) < durationMinutes;
  }

  /**
   * 1. Check Table Availability (checks reservations & Redis hold leases)
   */
  public static async checkAvailability(params: {
    tenantId: TenantId;
    date: string;
    time: string;
    guestCount: number;
    preferredArea?: TableArea;
  }): Promise<AvailabilityResult> {
    const { date, time, guestCount, preferredArea } = params;
    const profile = restaurantStore.getProfile();

    // 1. Business Rule: Operating Hours
    const hoursCheck = BusinessRuleEngine.validateOperatingHours(profile, time);
    if (!hoursCheck.passed) {
      return { available: false, availableTables: [], reason: hoursCheck.message };
    }

    // 2. Business Rule: Capacity
    const capacityCheck = BusinessRuleEngine.validateCapacity(guestCount, preferredArea);
    if (!capacityCheck.passed) {
      return { available: false, availableTables: [], reason: capacityCheck.message };
    }

    const allTables = restaurantStore.getTables();
    const suitableTables = allTables.filter((tbl) => {
      if (tbl.status === 'maintenance') return false;
      if (tbl.capacity < guestCount) return false;
      if (preferredArea && tbl.area !== preferredArea) return false;
      return true;
    });

    if (suitableTables.length === 0) {
      return {
        available: false,
        availableTables: [],
        reason: preferredArea
          ? `Tidak ditemukan meja di area ${preferredArea} yang mencukupi untuk ${guestCount} tamu.`
          : `Tidak ada meja yang cukup untuk kapasitas ${guestCount} orang.`,
      };
    }

    // Filter out tables that already have active reservations
    const activeReservations = restaurantStore.getAllReservations().filter((r) => {
      if (r.date !== date) return false;
      if (r.status === 'confirmed' || r.status === 'seated' || r.status === 'pending') {
        return this.isTimeOverlap(r.time, time);
      }
      return false;
    });

    // Check active hold leases from RedisLeaseManager
    const activeLeases = await RedisLeaseManager.getAllActiveLeases();
    const activeTimeLeases = activeLeases.filter((l) => {
      return l.date === date && this.isTimeOverlap(l.time, time);
    });

    const freeTables = suitableTables.filter((tbl) => {
      const hasResConflict = activeReservations.some((r) => r.tableId === tbl.id);
      const hasLeaseConflict = activeTimeLeases.some((l) => l.tableId === tbl.id);
      return !hasResConflict && !hasLeaseConflict;
    });

    if (freeTables.length === 0) {
      return {
        available: false,
        availableTables: [],
        reason: `Semua meja untuk kapasitas ${guestCount} tamu pada pukul ${time} tanggal ${date} sudah terisi. Silakan pilih jam lain.`,
      };
    }

    return {
      available: true,
      availableTables: freeTables,
    };
  }

  /**
   * 2. Two-Phase Hold Lease (Prevents Double Booking via Redis)
   */
  public static async createHoldLease(params: {
    tenantId: TenantId;
    conversationId: string;
    customerName: string;
    customerPhone: string;
    date: string;
    time: string;
    guestCount: number;
    preferredArea?: TableArea;
    notes?: string;
  }): Promise<{ success: boolean; lease?: TableHoldLease; message: string }> {
    const avail = await this.checkAvailability(params);
    if (!avail.available || avail.availableTables.length === 0) {
      return {
        success: false,
        message: avail.reason || 'Ketersediaan meja tidak mencukupi.',
      };
    }

    // Pick best table (smallest capacity that fits)
    const selectedTable = [...avail.availableTables].sort((a, b) => a.capacity - b.capacity)[0];

    const leaseToken = `lease_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const lease: TableHoldLease = {
      leaseToken,
      tableId: selectedTable.id,
      tableNumber: selectedTable.number,
      tableArea: selectedTable.area,
      date: params.date,
      time: params.time,
      guestCount: params.guestCount,
      tenantId: params.tenantId,
      conversationId: params.conversationId,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes lease
    };

    return await RedisLeaseManager.createHoldLease(lease, 600);
  }

  /**
   * 3. Atomic Commit of Leased Reservation (Releases Redis lock on completion)
   */
  public static async commitLeasedReservation(params: {
    leaseToken: string;
    customerName: string;
    customerPhone?: string;
    notes?: string;
    actor?: string;
  }): Promise<{ success: boolean; reservation?: Reservation; message: string }> {
    const lease = await RedisLeaseManager.getHoldLease(params.leaseToken);
    if (!lease) {
      return {
        success: false,
        message: 'Kunci slot meja sementara telah kadaluarsa atau tidak ditemukan. Mohon ulangi pengecekan ketersediaan.',
      };
    }

    if (Date.now() > lease.expiresAt) {
      await RedisLeaseManager.releaseHoldLease(params.leaseToken);
      return {
        success: false,
        message: 'Kunci slot meja sementara telah habis waktu (10 menit). Silakan pilih kembali jam yang diinginkan.',
      };
    }

    // Commit to restaurant store
    const result = restaurantStore.createReservation({
      customerName: params.customerName,
      customerPhone: params.customerPhone || '-',
      date: lease.date,
      time: lease.time,
      guestCount: lease.guestCount,
      preferredArea: lease.tableArea,
      notes: params.notes,
      actor: params.actor || 'AI Reservation Service',
    });

    // Remove lease on success
    if (result.success) {
      await RedisLeaseManager.releaseHoldLease(params.leaseToken);
    }

    return result;
  }

  /**
   * 4. Query Reservation by Code
   */
  public static getReservation(code: string): Reservation | undefined {
    return restaurantStore.getReservationByCode(code);
  }

  /**
   * 5. Cancel Reservation
   */
  public static cancelReservation(code: string, actor = 'AI Assistant', reason?: string): { success: boolean; message: string } {
    return restaurantStore.updateReservationStatus(code, 'cancelled', actor, reason || 'Dibatalkan oleh pelanggan via chat');
  }

  /**
   * 6. Reschedule / Update Reservation
   */
  public static updateReservation(
    code: string,
    data: { date?: string; time?: string; guestCount?: number; notes?: string },
    actor = 'AI Assistant'
  ): { success: boolean; message: string; reservation?: Reservation } {
    return restaurantStore.updateReservation(code, data, actor);
  }
}
