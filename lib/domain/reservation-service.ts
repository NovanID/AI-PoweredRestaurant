import {
  Reservation,
  Table,
  TableArea,
  TableHoldLease,
  TenantId,
} from './types';
import { BusinessRuleEngine } from './business-rules';
import { RedisLeaseManager } from '../infrastructure/redis-lease-manager';
import { PrismaRestaurantRepository } from '../db/prisma-repository';
import { getTenantCodePrefix } from '../tenants';

export interface AvailabilityResult {
  available: boolean;
  availableTables: Table[];
  reason?: string;
}

/**
 * Reservation domain service — PostgreSQL is the single source of truth.
 * Redis is only used for short-lived hold leases (two-phase booking).
 */
export class ReservationService {
  /**
   * 1. Check Table Availability (PostgreSQL reservations + Redis hold leases)
   */
  public static async checkAvailability(params: {
    tenantId: TenantId;
    date: string;
    time: string;
    guestCount: number;
    preferredArea?: TableArea;
  }): Promise<AvailabilityResult> {
    const { tenantId, date, time, guestCount, preferredArea } = params;

    const profile = await PrismaRestaurantRepository.getProfile(tenantId);
    if (!profile) {
      return {
        available: false,
        availableTables: [],
        reason: `Data restoran untuk tenant "${tenantId}" tidak ditemukan di database.`,
      };
    }

    // Business rules first (operating hours, capacity)
    const hoursCheck = BusinessRuleEngine.validateOperatingHours(profile, time);
    if (!hoursCheck.passed) {
      return { available: false, availableTables: [], reason: hoursCheck.message };
    }

    const capacityCheck = BusinessRuleEngine.validateCapacity(guestCount, preferredArea);
    if (!capacityCheck.passed) {
      return { available: false, availableTables: [], reason: capacityCheck.message };
    }

    // Repository checks DB reservations + Redis leases
    return PrismaRestaurantRepository.checkAvailability({
      tenantId,
      date,
      time,
      guestCount,
      preferredArea,
    });
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
   * 3. Atomic Commit of Leased Reservation into PostgreSQL.
   * The DB insert is authoritative: if it fails (double-book, invalid table,
   * connectivity), the booking FAILS — never silently succeed.
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

    // Tenant safety: the lease itself carries the tenantId captured at hold time.
    const prefix = getTenantCodePrefix(lease.tenantId);
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `${prefix}-${randomChars}`;

    try {
      const reservation = await PrismaRestaurantRepository.createReservation({
        tenantId: lease.tenantId,
        code,
        customerName: params.customerName,
        customerPhone: params.customerPhone || '-',
        tableId: lease.tableId,
        tableNumber: lease.tableNumber,
        tableArea: lease.tableArea,
        date: lease.date,
        time: lease.time,
        guestCount: lease.guestCount,
        notes: params.notes,
      });

      // Release the hold only after the DB row exists
      await RedisLeaseManager.releaseHoldLease(params.leaseToken);

      return {
        success: true,
        reservation,
        message: `Reservasi berhasil dikonfirmasi otomatis oleh sistem dengan kode ${code}. Meja Anda telah terkunci!`,
      };
    } catch (dbErr: any) {
      // DB failure = booking failure. Keep the lease so the slot stays held
      // until TTL expiry, preventing another guest from racing into it.
      console.error('[ReservationService] commitLeasedReservation DB error:', dbErr);
      return {
        success: false,
        message: dbErr?.message || 'Gagal menyimpan reservasi ke database. Silakan coba lagi.',
      };
    }
  }

  /**
   * 4. Query Reservation by Code (tenant-scoped)
   */
  public static async getReservation(tenantId: TenantId, code: string): Promise<Reservation | null> {
    return PrismaRestaurantRepository.getReservationByCode(tenantId, code);
  }

  /**
   * 5. Cancel Reservation (tenant-scoped)
   */
  public static async cancelReservation(
    tenantId: TenantId,
    code: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    return PrismaRestaurantRepository.cancelReservation(tenantId, code, reason || 'Dibatalkan oleh pelanggan via chat');
  }

  /**
   * 6. Reschedule / Update Reservation (tenant-scoped)
   */
  public static async updateReservation(
    tenantId: TenantId,
    code: string,
    data: { date?: string; time?: string; guestCount?: number }
  ): Promise<{ success: boolean; message: string; reservation?: Reservation }> {
    if (data.date && data.time) {
      return PrismaRestaurantRepository.rescheduleReservation(tenantId, code, {
        newDate: data.date,
        newTime: data.time,
        newGuestCount: data.guestCount,
        actor: 'AI Assistant',
      });
    }
    return PrismaRestaurantRepository.updateReservation(tenantId, code, {
      newDate: data.date,
      newTime: data.time,
      newGuestCount: data.guestCount,
    });
  }
}
