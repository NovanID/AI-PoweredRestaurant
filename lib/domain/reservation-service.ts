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

export interface AvailabilityResult {
  available: boolean;
  availableTables: Table[];
  reason?: string;
}

export class ReservationService {
  // In-memory hold leases table (in production backed by Redis with TTL)
  private static holdLeases: Map<string, TableHoldLease> = new Map();

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
   * Clean up expired leases
   */
  private static purgeExpiredLeases(): void {
    const now = Date.now();
    for (const [token, lease] of this.holdLeases.entries()) {
      if (lease.expiresAt < now) {
        this.holdLeases.delete(token);
      }
    }
  }

  /**
   * 1. Check Table Availability
   */
  public static checkAvailability(params: {
    tenantId: TenantId;
    date: string;
    time: string;
    guestCount: number;
    preferredArea?: TableArea;
  }): AvailabilityResult {
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

    this.purgeExpiredLeases();

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

    // Filter out tables that already have active reservations or active hold leases
    const activeReservations = restaurantStore.getAllReservations().filter((r) => {
      if (r.date !== date) return false;
      if (r.status === 'confirmed' || r.status === 'seated' || r.status === 'pending') {
        return this.isTimeOverlap(r.time, time);
      }
      return false;
    });

    const activeLeases = Array.from(this.holdLeases.values()).filter((l) => {
      return l.date === date && this.isTimeOverlap(l.time, time);
    });

    const freeTables = suitableTables.filter((tbl) => {
      const hasResConflict = activeReservations.some((r) => r.tableId === tbl.id);
      const hasLeaseConflict = activeLeases.some((l) => l.tableId === tbl.id);
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
   * 2. Two-Phase Hold Lease (Prevents Double Booking)
   */
  public static createHoldLease(params: {
    tenantId: TenantId;
    conversationId: string;
    customerName: string;
    customerPhone: string;
    date: string;
    time: string;
    guestCount: number;
    preferredArea?: TableArea;
    notes?: string;
  }): { success: boolean; lease?: TableHoldLease; message: string } {
    const avail = this.checkAvailability(params);
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

    this.holdLeases.set(leaseToken, lease);

    return {
      success: true,
      lease,
      message: `Slot Meja ${selectedTable.number} (${selectedTable.area}) berhasil dikunci sementara selama 10 menit.`,
    };
  }

  /**
   * 3. Atomic Commit of Leased Reservation
   */
  public static commitLeasedReservation(params: {
    leaseToken: string;
    customerName: string;
    customerPhone?: string;
    notes?: string;
    actor?: string;
  }): { success: boolean; reservation?: Reservation; message: string } {
    const lease = this.holdLeases.get(params.leaseToken);
    if (!lease) {
      return {
        success: false,
        message: 'Kunci slot meja sementara telah kadaluarsa atau tidak ditemukan. Mohon ulangi pengecekan ketersediaan.',
      };
    }

    if (Date.now() > lease.expiresAt) {
      this.holdLeases.delete(params.leaseToken);
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
      this.holdLeases.delete(params.leaseToken);
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
