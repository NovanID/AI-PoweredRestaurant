import { prisma } from '../prisma';
import {
  RestaurantProfile,
  Table,
  MenuItem,
  Reservation,
  TableArea,
  TableStatus,
  MenuCategory,
  ReservationStatus,
  PaymentStatus,
  TenantId,
  OrderItem,
  AuditEvent,
} from '../domain/types';
import { MenuCategory as PrismaMenuCategory } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RedisLeaseManager } from '../infrastructure/redis-lease-manager';
import { getExpectedPaymentAmount, isExpectedPaymentAmount } from '../midtrans';
import { DEFAULT_TENANT_ID } from '../mock-data';
import { getTenantCodePrefix } from '../tenants';

const TO_DOMAIN_CATEGORY: Record<PrismaMenuCategory, MenuCategory> = {
  [PrismaMenuCategory.LAUK_UTAMA]: 'Lauk Utama',
  [PrismaMenuCategory.SAYUR_KUAH]: 'Sayur & Kuah',
  [PrismaMenuCategory.PELENGKAP_SAMBAL]: 'Pelengkap & Sambal',
  [PrismaMenuCategory.MINUMAN]: 'Minuman',
};

const TO_PRISMA_CATEGORY: Record<string, PrismaMenuCategory> = {
  'Lauk Utama': PrismaMenuCategory.LAUK_UTAMA,
  'Sayur & Kuah': PrismaMenuCategory.SAYUR_KUAH,
  'Pelengkap & Sambal': PrismaMenuCategory.PELENGKAP_SAMBAL,
  'Minuman': PrismaMenuCategory.MINUMAN,
};

export class PrismaRestaurantRepository {
  /**
   * 1. Get Restaurant Profile
   */
  public static async getProfile(tenantId: TenantId): Promise<RestaurantProfile | null> {
    const r = await prisma.restaurant.findUnique({
      where: { tenantId },
    });
    if (!r) return null;

    return {
      tenantId: r.tenantId,
      name: r.name,
      tagline: r.tagline || '',
      address: r.address,
      city: r.city,
      phone: r.phone,
      openingHours: r.openingHours,
      openTime: r.openTime,
      closeTime: r.closeTime,
      description: r.description || '',
      policies: Array.isArray(r.policies) ? (r.policies as string[]) : [],
    };
  }

  /**
   * 2. Get Menu Items with filters
   */
  public static async getMenuItems(params: {
    tenantId?: TenantId;
    category?: string;
    search?: string;
    maxPrice?: number;
    spicinessLevel?: number;
  } = {}): Promise<MenuItem[]> {
    const { tenantId = DEFAULT_TENANT_ID, category, search, maxPrice, spicinessLevel } = params;

    const where: any = { tenantId };

    if (category && category !== 'Semua') {
      const prismaCat = TO_PRISMA_CATEGORY[category];
      if (prismaCat) {
        where.category = prismaCat;
      }
    }

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (maxPrice && maxPrice > 0) {
      where.price = { lte: maxPrice };
    }

    if (spicinessLevel && spicinessLevel > 0) {
      where.spicinessLevel = spicinessLevel;
    }

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
    });

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      category: TO_DOMAIN_CATEGORY[item.category] || 'Lauk Utama',
      price: Number(item.price),
      description: item.description || '',
      isAvailable: item.isAvailable,
      isPopular: item.isPopular,
      spicinessLevel: (item.spicinessLevel as 1 | 2 | 3) || 1,
      tenantId: item.tenantId,
    }));
  }

  /**
   * 2b. Get Menu Items for ALL tenants (used to build the shared search index)
   */
  public static async getMenuItemsForAllTenants(): Promise<MenuItem[]> {
    const items = await prisma.menuItem.findMany({
      orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
    });

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      category: TO_DOMAIN_CATEGORY[item.category] || 'Lauk Utama',
      price: Number(item.price),
      description: item.description || '',
      isAvailable: item.isAvailable,
      isPopular: item.isPopular,
      spicinessLevel: (item.spicinessLevel as 1 | 2 | 3) || 1,
      tenantId: item.tenantId,
    }));
  }

  /**
   * 3. Get All Tables
   */
  public static async getTables(tenantId: TenantId): Promise<Table[]> {
    const tables = await prisma.table.findMany({
      where: { tenantId },
      orderBy: { tableNumber: 'asc' },
    });

    return tables.map((t) => ({
      id: t.id,
      number: t.tableNumber,
      capacity: t.capacity,
      area: t.area as TableArea,
      status: t.status as TableStatus,
      tenantId: t.tenantId,
    }));
  }

  /**
   * 4. Check Table Availability against PostgreSQL reservations
   */
  public static async checkAvailability(params: {
    tenantId: TenantId;
    date: string;
    time: string;
    guestCount: number;
    preferredArea?: TableArea;
    durationMinutes?: number;
  }): Promise<{ available: boolean; availableTables: Table[]; reason?: string }> {
    const { tenantId, date, time, guestCount, preferredArea, durationMinutes = 90 } = params;

    // Fetch suitable tables from DB
    const tableWhere: any = {
      tenantId,
      status: { not: 'maintenance' },
      capacity: { gte: guestCount },
    };
    if (preferredArea) {
      tableWhere.area = preferredArea;
    }

    const suitableTables = await prisma.table.findMany({
      where: tableWhere,
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

    // Check existing active reservations for date
    const existingReservations = await prisma.reservation.findMany({
      where: {
        tenantId,
        reservationDate: date,
        status: { in: ['confirmed', 'seated', 'pending'] },
      },
    });

    // Helper time overlap
    const isOverlap = (t1: string, t2: string) => {
      const [h1, m1] = t1.split(':').map(Number);
      const [h2, m2] = t2.split(':').map(Number);
      return Math.abs(h1 * 60 + m1 - (h2 * 60 + m2)) < durationMinutes;
    };

    const conflictingTableIds = new Set(
      existingReservations
        .filter((r) => isOverlap(r.reservationTime, time))
        .map((r) => r.tableId)
    );

    // Fetch active hold leases from Redis
    let leaseConflictTableIds = new Set<string>();
    try {
      const activeLeases = await RedisLeaseManager.getAllActiveLeases();
      const activeTimeLeases = activeLeases.filter((l) => {
        return l.tenantId === tenantId && l.date === date && isOverlap(l.time, time);
      });
      leaseConflictTableIds = new Set(activeTimeLeases.map((l) => l.tableId));
    } catch (redisErr) {
      console.warn('[PrismaRestaurantRepository] Failed to check Redis leases:', redisErr);
    }

    const freeTables = suitableTables
      .filter((tbl) => !conflictingTableIds.has(tbl.id) && !leaseConflictTableIds.has(tbl.id))
      .map((t) => ({
        id: t.id,
        number: t.tableNumber,
        capacity: t.capacity,
        area: t.area as TableArea,
        status: t.status as TableStatus,
        tenantId: t.tenantId,
      }));

    if (freeTables.length === 0) {
      return {
        available: false,
        availableTables: [],
        reason: `Semua meja untuk kapasitas ${guestCount} tamu pada pukul ${time} tanggal ${date} sudah terisi.`,
      };
    }

    return {
      available: true,
      availableTables: freeTables,
    };
  }

  /**
   * 5. Create Confirmed Reservation in PostgreSQL (atomic).
   * Inside one transaction:
   *  - validates the table belongs to the SAME tenant
   *  - re-checks slot conflicts (double-booking guard, row-locked)
   *  - inserts the reservation
   * Throws on any validation failure or conflict — callers must treat that as
   * a failed booking (never silently succeed).
   */
  public static async createReservation(data: {
    tenantId: TenantId;
    code: string;
    customerName: string;
    customerPhone: string;
    tableId: string;
    tableNumber: string;
    tableArea: TableArea;
    date: string;
    time: string;
    guestCount: number;
    notes?: string;
    paymentStatus?: PaymentStatus;
    paymentAmount?: number;
    snapToken?: string;
  }): Promise<Reservation> {
    const created = await prisma.$transaction(async (tx) => {
      // Tenant isolation: the table MUST belong to the same tenant
      const table = await tx.table.findFirst({
        where: { id: data.tableId, tenantId: data.tenantId },
      });
      if (!table) {
        throw new Error(
          `Meja tidak valid untuk tenant ini (tableId=${data.tableId}). Reservasi ditolak demi isolasi data.`
        );
      }

      // Double-booking guard: lock rows for this table/date and check overlap
      const conflicts = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM reservations
        WHERE table_id = ${data.tableId}
          AND tenant_id = ${data.tenantId}
          AND reservation_date = ${data.date}
          AND status IN ('confirmed', 'seated', 'pending')
        FOR UPDATE
      `;
      const toMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
      };
      const newMin = toMinutes(data.time);
      if (conflicts.length > 0) {
        const overlapping = await tx.reservation.findMany({
          where: { id: { in: conflicts.map((c) => c.id) } },
          select: { reservationTime: true, code: true },
        });
        const clash = overlapping.find((r) => Math.abs(toMinutes(r.reservationTime) - newMin) < 90);
        if (clash) {
          throw new Error(
            `Meja ${data.tableNumber} sudah terbooking pada slot berdekatan (tiket ${clash.code}). Pilih jam atau meja lain.`
          );
        }
      }

      return tx.reservation.create({
        data: {
          tenantId: data.tenantId,
          code: data.code,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          tableId: table.id,
          tableNumber: table.tableNumber,
          tableArea: table.area,
          reservationDate: data.date,
          reservationTime: data.time,
          guestCount: data.guestCount,
          status: 'confirmed',
          autoConfirmed: true,
          qrToken: `QR-${data.code}-VERIFIED`,
          notes: data.notes,
          paymentStatus: data.paymentStatus || 'unpaid',
          paymentAmount: data.paymentAmount ? Number(data.paymentAmount) : null,
          snapToken: data.snapToken,
        },
      });
    });

    // Record customer visit count in background
    await prisma.customer.upsert({
      where: {
        tenantId_phone: {
          tenantId: data.tenantId,
          phone: data.customerPhone,
        },
      },
      update: {
        name: data.customerName,
        reservationCount: { increment: 1 },
        lastVisit: new Date(),
      },
      create: {
        tenantId: data.tenantId,
        name: data.customerName,
        phone: data.customerPhone,
        reservationCount: 1,
        lastVisit: new Date(),
      },
    }).catch(() => {});

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        tenantId: data.tenantId,
        actor: 'AI Assistant',
        action: 'CREATE_RESERVATION',
        entity: `Tiket ${data.code}`,
        details: `Reservasi meja ${data.tableNumber} (${data.tableArea}) untuk ${data.guestCount} orang pada ${data.date} ${data.time}`,
      },
    }).catch(() => {});

    return {
      id: created.id,
      code: created.code,
      customerName: created.customerName,
      customerPhone: created.customerPhone,
      tableId: created.tableId || '',
      tableNumber: created.tableNumber,
      tableArea: created.tableArea as TableArea,
      date: created.reservationDate,
      time: created.reservationTime,
      guestCount: created.guestCount,
      status: created.status as ReservationStatus,
      autoConfirmed: created.autoConfirmed,
      notes: created.notes || undefined,
      paymentStatus: created.paymentStatus as PaymentStatus,
      paymentAmount: created.paymentAmount ? Number(created.paymentAmount) : undefined,
      snapToken: created.snapToken || undefined,
      tenantId: created.tenantId,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  public static async createTakeawayOrder(params: {
    tenantId: TenantId;
    customerName: string;
    customerPhone: string;
    items: OrderItem[];
    notes?: string;
  }): Promise<Reservation> {
    const subtotal = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal + Math.round(subtotal * 0.1);
    const now = new Date();
    const code = `TK-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    const created = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          tenantId: params.tenantId,
          code,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          tableId: null,
          tableNumber: 'Bungkus / Take Away',
          // ponytail: reuse TableArea until takeaway becomes a dedicated Order model.
          tableArea: 'Outdoor',
          reservationDate: now.toISOString().split('T')[0],
          reservationTime: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'),
          guestCount: 1,
          status: 'pending',
          autoConfirmed: false,
          qrToken: `QR-${code}-TAKEAWAY`,
          paymentStatus: 'unpaid',
          paymentAmount: total,
          orderItems: params.items as any,
          orderTotal: total,
          notes: params.notes || 'Pesanan Bungkus (Take Away)',
        },
      });

      if (params.customerPhone !== '-') {
        await tx.customer.upsert({
          where: { tenantId_phone: { tenantId: params.tenantId, phone: params.customerPhone } },
          update: { name: params.customerName },
          create: {
            tenantId: params.tenantId,
            name: params.customerName,
            phone: params.customerPhone,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          tenantId: params.tenantId,
          actor: 'AI Assistant (Takeaway)',
          action: 'CREATE_TAKEAWAY_ORDER',
          entity: `Pesanan ${code}`,
          details: `${params.items.length} item, total Rp ${total.toLocaleString('id-ID')}`,
        },
      });

      return reservation;
    });

    return this.mapPrismaReservation(created);
  }

  /**
   * 6. Get Reservation by Code
   */
  public static async getReservationByCode(tenantId: TenantId, code: string): Promise<Reservation | null> {
    const res = await prisma.reservation.findFirst({
      where: {
        tenantId,
        code: code.trim().toUpperCase(),
      },
    });

    if (!res) return null;

    return {
      id: res.id,
      code: res.code,
      customerName: res.customerName,
      customerPhone: res.customerPhone,
      tableId: res.tableId || '',
      tableNumber: res.tableNumber,
      tableArea: res.tableArea as TableArea,
      date: res.reservationDate,
      time: res.reservationTime,
      guestCount: res.guestCount,
      status: res.status as ReservationStatus,
      autoConfirmed: res.autoConfirmed,
      notes: res.notes || undefined,
      paymentStatus: res.paymentStatus as PaymentStatus,
      paymentAmount: res.paymentAmount ? Number(res.paymentAmount) : undefined,
      snapToken: res.snapToken || undefined,
      tenantId: res.tenantId,
      createdAt: res.createdAt.toISOString(),
      updatedAt: res.updatedAt.toISOString(),
    };
  }

  /**
   * 7. Cancel Reservation
   */
  public static async cancelReservation(tenantId: TenantId, code: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const res = await prisma.reservation.findFirst({
      where: { tenantId, code: code.trim().toUpperCase() },
    });

    if (!res) {
      return { success: false, message: `Reservasi dengan kode "${code}" tidak ditemukan.` };
    }

    if (res.status === 'cancelled') {
      return { success: false, message: `Reservasi ${code} sudah pernah dibatalkan sebelumnya.` };
    }

    await prisma.reservation.update({
      where: { id: res.id },
      data: {
        status: 'cancelled',
        rejectionReason: reason || 'Dibatalkan oleh pelanggan',
      },
    });

    await prisma.auditEvent.create({
      data: {
        tenantId,
        actor: 'AI Assistant',
        action: 'CANCEL_RESERVATION',
        entity: `Tiket ${code}`,
        details: reason || 'Dibatalkan oleh pelanggan',
      },
    }).catch(() => {});

    return { success: true, message: `Reservasi ${code} berhasil dibatalkan.` };
  }

  /**
   * 8. Update Reservation Schedule
   */
  public static async updateReservation(
    tenantId: TenantId,
    code: string,
    data: { newDate?: string; newTime?: string; newGuestCount?: number }
  ): Promise<{ success: boolean; message: string; reservation?: Reservation }> {
    const res = await prisma.reservation.findFirst({
      where: { tenantId, code: code.trim().toUpperCase() },
    });

    if (!res) {
      return { success: false, message: `Reservasi dengan kode "${code}" tidak ditemukan.` };
    }

    const updated = await prisma.reservation.update({
      where: { id: res.id },
      data: {
        reservationDate: data.newDate || res.reservationDate,
        reservationTime: data.newTime || res.reservationTime,
        guestCount: data.newGuestCount || res.guestCount,
      },
    });

    return {
      success: true,
      message: `Jadwal reservasi ${code} berhasil diperbarui ke tanggal ${updated.reservationDate} pukul ${updated.reservationTime} WIB (${updated.guestCount} orang).`,
      reservation: {
        id: updated.id,
        code: updated.code,
        customerName: updated.customerName,
        customerPhone: updated.customerPhone,
        tableId: updated.tableId || '',
        tableNumber: updated.tableNumber,
        tableArea: updated.tableArea as TableArea,
        date: updated.reservationDate,
        time: updated.reservationTime,
        guestCount: updated.guestCount,
        status: updated.status as ReservationStatus,
        tenantId: updated.tenantId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }

  /**
   * 8b. Reschedule Reservation atomically:
   * validates the target slot against DB reservations + Redis holds,
   * re-assigns a free table if needed, all inside one transaction.
   */
  public static async rescheduleReservation(
    tenantId: TenantId,
    code: string,
    data: { newDate: string; newTime: string; newGuestCount?: number; actor?: string }
  ): Promise<{ success: boolean; message: string; reservation?: Reservation }> {
    const clean = code.trim().toUpperCase();
    const target = await prisma.reservation.findFirst({ where: { tenantId, code: clean } });
    if (!target) {
      return { success: false, message: `Reservasi dengan kode "${code}" tidak ditemukan.` };
    }
    if (['cancelled', 'completed', 'rejected', 'no_show', 'expired'].includes(target.status)) {
      return {
        success: false,
        message: `Reservasi ${code} dengan status "${target.status}" tidak dapat dijadwalkan ulang.`,
      };
    }

    const newGuests = data.newGuestCount || target.guestCount;

    // Business rule: operating hours
    const profile = await this.getProfile(tenantId);
    if (profile) {
      const [h, m] = data.newTime.split(':').map(Number);
      const reqMin = h * 60 + (m || 0);
      const [oH, oM] = profile.openTime.split(':').map(Number);
      const [cH, cM] = profile.closeTime.split(':').map(Number);
      if (reqMin < oH * 60 + oM || reqMin + 60 > cH * 60 + cM) {
        return {
          success: false,
          message: `${profile.name} hanya melayani reservasi antara ${profile.openTime} – ${profile.closeTime} WIB.`,
        };
      }
    }

    // Server-side availability for the NEW slot
    const avail = await this.checkAvailability({
      tenantId,
      date: data.newDate,
      time: data.newTime,
      guestCount: newGuests,
      preferredArea: target.tableArea,
    });
    if (!avail.available || avail.availableTables.length === 0) {
      return {
        success: false,
        message: `Jadwal baru (${data.newDate} jam ${data.newTime}) tidak tersedia. ${avail.reason || ''}`.trim(),
      };
    }

    const selectedTable = [...avail.availableTables].sort((a, b) => a.capacity - b.capacity)[0];

    const updated = await prisma.reservation.update({
      where: { id: target.id },
      data: {
        reservationDate: data.newDate,
        reservationTime: data.newTime,
        guestCount: newGuests,
        tableId: selectedTable.id,
        tableNumber: selectedTable.number,
        tableArea: selectedTable.area,
        status: 'confirmed',
        autoConfirmed: true,
      },
    });

    await this.recordAudit({
      tenantId,
      actor: data.actor || 'Sistem Reservasi',
      action: 'AUTO_RESCHEDULE_RESERVATION',
      entity: `Tiket ${clean}`,
      details: `Jadwal dipindah ke ${data.newDate} ${data.newTime} WIB (${newGuests} tamu) — Meja ${selectedTable.number} (${selectedTable.area}).`,
    });

    return {
      success: true,
      message: `Jadwal reservasi ${clean} berhasil diperbarui ke tanggal ${data.newDate} pukul ${data.newTime} WIB, Meja ${selectedTable.number}.`,
      reservation: this.mapPrismaReservation(updated),
    };
  }

  /**
   * Helper: Map Prisma Reservation model to Domain Reservation
   */
  public static mapPrismaReservation(res: any): Reservation {
    return {
      id: res.id,
      code: res.code,
      customerName: res.customerName,
      customerPhone: res.customerPhone,
      tableId: res.tableId || '',
      tableNumber: res.tableNumber,
      tableArea: res.tableArea as TableArea,
      date: res.reservationDate,
      time: res.reservationTime,
      guestCount: res.guestCount,
      status: res.status as ReservationStatus,
      autoConfirmed: res.autoConfirmed,
      qrToken: res.qrToken || undefined,
      seatedAt: res.seatedAt ? res.seatedAt.toISOString() : undefined,
      completedAt: res.completedAt ? res.completedAt.toISOString() : undefined,
      expiresAt: res.expiresAt ? res.expiresAt.toISOString() : undefined,
      paymentStatus: res.paymentStatus as PaymentStatus,
      paymentAmount: res.paymentAmount ? Number(res.paymentAmount) : undefined,
      paymentMethod: res.paymentMethod || undefined,
      snapToken: res.snapToken || undefined,
      paymentPaidAt: res.paymentPaidAt ? res.paymentPaidAt.toISOString() : undefined,
      orderItems: Array.isArray(res.orderItems) ? res.orderItems : [],
      orderTotal: res.orderTotal ? Number(res.orderTotal) : undefined,
      notes: res.notes || undefined,
      rejectionReason: res.rejectionReason || undefined,
      tenantId: res.tenantId,
      createdAt: res.createdAt.toISOString(),
      updatedAt: res.updatedAt.toISOString(),
    };
  }

  /**
   * 9. Get All Reservations for Admin Dashboard
   */
  public static async getAllReservations(tenantId: TenantId): Promise<Reservation[]> {
    const list = await prisma.reservation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map(this.mapPrismaReservation);
  }

  /**
   * 10. Update Reservation Status & Sync Table
   */
  public static async updateReservationStatus(
    tenantId: TenantId,
    code: string,
    status: ReservationStatus,
    actor: string = 'Staff Admin',
    reason?: string
  ): Promise<{ success: boolean; message: string; reservation?: Reservation }> {
    const res = await prisma.reservation.findFirst({
      where: { tenantId, code: code.trim().toUpperCase() },
    });
    if (!res) return { success: false, message: `Reservasi ${code} tidak ditemukan.` };

    const updateData: any = { status };
    if (reason) updateData.rejectionReason = reason;
    if (status === 'seated' && !res.seatedAt) updateData.seatedAt = new Date();
    if (status === 'completed' && !res.completedAt) updateData.completedAt = new Date();

    const updated = await prisma.reservation.update({
      where: { id: res.id },
      data: updateData,
    });

    // If seated, mark table occupied; if completed/cancelled/rejected/no_show, release table if free
    if (status === 'seated' && res.tableId) {
      await prisma.table.update({
        where: { id: res.tableId },
        data: { status: 'occupied' },
      }).catch(() => {});
    } else if (res.tableId && ['completed', 'cancelled', 'rejected', 'no_show'].includes(status)) {
      const otherSeated = await prisma.reservation.findFirst({
        where: {
          tenantId,
          tableId: res.tableId,
          status: 'seated',
          id: { not: res.id },
        },
      });
      if (!otherSeated) {
        await prisma.table.update({
          where: { id: res.tableId },
          data: { status: 'available' },
        }).catch(() => {});
      }
    }

    await this.recordAudit({
      tenantId,
      actor,
      action: 'UPDATE_RESERVATION_STATUS',
      entity: `Tiket ${code}`,
      details: `Status diubah menjadi "${status}"${reason ? ` (Alasan: ${reason})` : ''}`,
    });

    return {
      success: true,
      message: `Status reservasi ${code} berhasil diubah menjadi ${status}.`,
      reservation: this.mapPrismaReservation(updated),
    };
  }

  /**
   * 11. Update Table Status directly
   */
  public static async updateTableStatus(
    tenantId: TenantId,
    tableId: string,
    status: TableStatus,
    actor: string = 'Staff Admin'
  ): Promise<{ success: boolean; message: string; table?: Table }> {
    const tbl = await prisma.table.findFirst({
      where: { id: tableId, tenantId },
    });
    if (!tbl) return { success: false, message: 'Meja tidak ditemukan.' };

    const updated = await prisma.table.update({
      where: { id: tableId },
      data: { status },
    });

    await this.recordAudit({
      tenantId,
      actor,
      action: 'UPDATE_TABLE_STATUS',
      entity: `Meja ${tbl.tableNumber}`,
      details: `Status meja diubah menjadi "${status}"`,
    });

    return {
      success: true,
      message: `Status meja ${tbl.tableNumber} berhasil diubah ke ${status}.`,
      table: {
        id: updated.id,
        number: updated.tableNumber,
        capacity: updated.capacity,
        area: updated.area as TableArea,
        status: updated.status as TableStatus,
        tenantId: updated.tenantId,
      },
    };
  }

  /**
   * 12. Create Walk-In Seated Reservation
   */
  public static async createWalkInSeated(
    tenantId: TenantId,
    params: { tableId: string; guestCount?: number; actor?: string; code?: string }
  ): Promise<{ success: boolean; message: string; reservation?: Reservation }> {
    const { tableId, guestCount, actor = 'Staff Kasir (Budi)', code: customCode } = params;
    const table = await prisma.table.findFirst({ where: { id: tableId, tenantId } });
    if (!table) return { success: false, message: 'Meja tidak ditemukan.' };
    if (table.status === 'maintenance') return { success: false, message: `Meja ${table.tableNumber} sedang perbaikan.` };

    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = customCode || `WI-${randomChars}`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

    const [_, created] = await prisma.$transaction([
      prisma.table.update({
        where: { id: table.id },
        data: { status: 'occupied' },
      }),
      prisma.reservation.create({
        data: {
          tenantId,
          code,
          customerName: `Tamu Walk-In (${table.tableNumber})`,
          customerPhone: '-',
          tableId: table.id,
          tableNumber: table.tableNumber,
          tableArea: table.area,
          reservationDate: dateStr,
          reservationTime: timeStr,
          guestCount: guestCount || table.capacity,
          status: 'seated',
          autoConfirmed: true,
          qrToken: `QR-${code}-WALKIN`,
          seatedAt: now,
          paymentStatus: 'unpaid',
          notes: 'Tamu langsung datang tanpa reservasi (Walk-In)',
        },
      }),
    ]);

    await this.recordAudit({
      tenantId,
      actor,
      action: 'WALK_IN_SEATED',
      entity: `Meja ${table.tableNumber}`,
      details: `Tamu Walk-In (${created.guestCount} orang) didudukkan di Meja ${table.tableNumber} (Tiket: ${code}).`,
    });

    return {
      success: true,
      message: `Tamu Walk-In berhasil didudukkan di Meja ${table.tableNumber}. Status meja menjadi Terisi (Seated).`,
      reservation: this.mapPrismaReservation(created),
    };
  }

  /**
   * 13. Create Manual Offline Booking
   */
  public static async createManualOfflineBooking(
    tenantId: TenantId,
    data: {
      customerName: string;
      customerPhone?: string;
      tableId: string;
      guestCount: number;
      notes?: string;
      actionType: 'seated_now' | 'scheduled';
      date?: string;
      time?: string;
      actor?: string;
      code?: string;
    }
  ): Promise<{ success: boolean; message: string; reservation?: Reservation }> {
    const table = await prisma.table.findFirst({ where: { id: data.tableId, tenantId } });
    if (!table) return { success: false, message: 'Meja tidak ditemukan.' };
    if (table.status === 'maintenance') return { success: false, message: `Meja ${table.tableNumber} sedang maintenance.` };

    const now = new Date();
    const isSeatedNow = data.actionType === 'seated_now';
    const dateStr = data.date || now.toISOString().split('T')[0];
    const timeStr = data.time || now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = getTenantCodePrefix(tenantId);
    const code = data.code || (isSeatedNow ? `WI-${randomChars}` : `${prefix}-M${randomChars}`);

    const txOps: any[] = [];
    if (isSeatedNow) {
      txOps.push(prisma.table.update({ where: { id: table.id }, data: { status: 'occupied' } }));
    }

    txOps.push(
      prisma.reservation.create({
        data: {
          tenantId,
          code,
          customerName: data.customerName.trim() || `Tamu Offline (${table.tableNumber})`,
          customerPhone: data.customerPhone?.trim() || '-',
          tableId: table.id,
          tableNumber: table.tableNumber,
          tableArea: table.area,
          reservationDate: dateStr,
          reservationTime: timeStr,
          guestCount: data.guestCount || table.capacity,
          status: isSeatedNow ? 'seated' : 'confirmed',
          autoConfirmed: true,
          qrToken: `QR-${code}-OFFLINE`,
          seatedAt: isSeatedNow ? now : null,
          paymentStatus: 'unpaid',
          notes: data.notes || (isSeatedNow ? 'Tamu Walk-In Kasir Offline' : 'Reservasi Manual Kasir'),
        },
      })
    );

    const results = await prisma.$transaction(txOps);
    const created = isSeatedNow ? results[1] : results[0];

    await this.recordAudit({
      tenantId,
      actor: data.actor || 'Staf Kasir Offline',
      action: isSeatedNow ? 'MANUAL_WALKIN_SEATED' : 'MANUAL_RESERVATION_CREATED',
      entity: `Meja ${table.tableNumber}`,
      details: `Input tamu manual (${created.customerName}, ${created.guestCount} orang, ${created.status}) di Meja ${table.tableNumber}.`,
    });

    return {
      success: true,
      message: `Tamu ${created.customerName} berhasil dicatat di Meja ${table.tableNumber} (Kode: ${code}).`,
      reservation: this.mapPrismaReservation(created),
    };
  }

  /**
   * 14. Add POS Order Items to Reservation
   */
  public static async addOrderItemsToReservation(
    tenantId: TenantId,
    code: string,
    items: OrderItem[],
    actor: string = 'Staf Kasir'
  ): Promise<{ success: boolean; message: string; reservation?: Reservation }> {
    const clean = code.trim().toUpperCase();
    const target = await prisma.reservation.findFirst({ where: { tenantId, code: clean } });
    if (!target) return { success: false, message: `Tiket tamu ${code} tidak ditemukan.` };

    if (!items.length || items.some((item) => !item.menuItemId || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return { success: false, message: 'Item POS tidak valid.' };
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { tenantId, id: { in: [...new Set(items.map((item) => item.menuItemId))] }, isAvailable: true },
    });
    const menuById = new Map(menuItems.map((item) => [item.id, item]));
    if (items.some((item) => !menuById.has(item.menuItemId))) {
      return { success: false, message: 'Salah satu menu tidak ditemukan atau sedang habis.' };
    }

    const normalizedItems = items.map((item) => {
      const menuItem = menuById.get(item.menuItemId)!;
      return { ...item, name: menuItem.name, price: Number(menuItem.price) };
    });
    const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const updated = await prisma.reservation.update({
      where: { id: target.id },
      data: {
        orderItems: normalizedItems as any,
        orderTotal: total,
        paymentAmount: total,
      },
    });

    await this.recordAudit({
      tenantId,
      actor,
      action: 'UPDATE_TABLE_ORDER',
      entity: `Reservasi ${target.code}`,
      details: `Pesanan ${normalizedItems.length} menu ditambahkan ke Meja ${target.tableNumber}. Total Tagihan: Rp ${total.toLocaleString('id-ID')}`,
    });

    return {
      success: true,
      message: `Pesanan Meja ${target.tableNumber} berhasil disimpan (Total: Rp ${total.toLocaleString('id-ID')}).`,
      reservation: this.mapPrismaReservation(updated),
    };
  }

  /**
   * 15. Settle Offline Payment at POS
   */
  public static async settleOfflinePayment(
    tenantId: TenantId,
    code: string,
    paymentMethod: string = 'Tunai / Cash',
    actor: string = 'Staf Kasir'
  ): Promise<{ success: boolean; message: string; reservation?: Reservation }> {
    const clean = code.trim().toUpperCase();
    const target = await prisma.reservation.findFirst({ where: { tenantId, code: clean } });
    if (!target) return { success: false, message: `Tiket tamu ${code} tidak ditemukan.` };

    const updated = await prisma.reservation.update({
      where: { id: target.id },
      data: {
        paymentStatus: 'settlement',
        paymentMethod,
        paymentPaidAt: new Date(),
      },
    });

    const amount = Number(target.orderTotal || target.paymentAmount || 0);

    await this.recordAudit({
      tenantId,
      actor,
      action: 'OFFLINE_PAYMENT_SETTLED',
      entity: `Reservasi ${target.code}`,
      details: `Pembayaran pesanan Rp ${amount.toLocaleString('id-ID')} lunas via ${paymentMethod}.`,
    });

    return {
      success: true,
      message: `Pembayaran tiket ${target.code} (Meja ${target.tableNumber}) BERHASIL LUNAS via ${paymentMethod}.`,
      reservation: this.mapPrismaReservation(updated),
    };
  }

  /**
   * 16. Floor Lifecycle Shortcuts
   */
  public static async markAsSeated(tenantId: TenantId, code: string, actor: string = 'Staf Penerima Tamu') {
    return this.updateReservationStatus(tenantId, code, 'seated', actor);
  }

  public static async markAsCompleted(tenantId: TenantId, code: string, actor: string = 'Staf Kasir / Waiter') {
    return this.updateReservationStatus(tenantId, code, 'completed', actor);
  }

  public static async markAsNoShow(tenantId: TenantId, code: string, actor: string = 'Staf Restoran', reason: string = 'Tamu tidak hadir melewati batas toleransi 30 menit') {
    return this.updateReservationStatus(tenantId, code, 'no_show', actor, reason);
  }

  /**
   * 17. Toggle Menu Item Availability
   */
  public static async toggleMenuItemAvailability(
    tenantId: TenantId,
    id: string,
    actor: string = 'Staff Dapur'
  ): Promise<{ success: boolean; message: string; menuItem?: MenuItem }> {
    const item = await prisma.menuItem.findFirst({ where: { id, tenantId } });
    if (!item) return { success: false, message: 'Menu tidak ditemukan.' };

    const updated = await prisma.menuItem.update({
      where: { id: item.id },
      data: { isAvailable: !item.isAvailable },
    });

    await this.recordAudit({
      tenantId,
      actor,
      action: 'TOGGLE_MENU_AVAILABILITY',
      entity: `Menu ${item.name}`,
      details: `Status menu diubah menjadi ${updated.isAvailable ? 'Tersedia' : 'Habis'}`,
    });

    return {
      success: true,
      message: `Menu ${item.name} sekarang ${updated.isAvailable ? 'Tersedia' : 'Habis (Sold Out)'}.`,
      menuItem: {
        id: updated.id,
        name: updated.name,
        category: TO_DOMAIN_CATEGORY[updated.category] || 'Lauk Utama',
        price: Number(updated.price),
        description: updated.description || '',
        isAvailable: updated.isAvailable,
        isPopular: updated.isPopular,
        spicinessLevel: (updated.spicinessLevel as 1 | 2 | 3) || 1,
        tenantId: updated.tenantId,
      },
    };
  }

  /**
   * 18. Update Payment Status (for Midtrans Webhook & POS)
   */
  public static async updatePaymentStatus(
    tenantId: TenantId,
    code: string,
    paymentStatus: PaymentStatus,
    paymentMethod?: string,
    amount?: number,
    actor: string = 'Midtrans Webhook'
  ): Promise<{ success: boolean; message: string; reservation?: Reservation }> {
    const clean = code.trim().toUpperCase();
    const target = await prisma.reservation.findFirst({ where: { tenantId, code: clean } });
    if (!target) return { success: false, message: `Reservasi ${code} tidak ditemukan.` };

    if (target.paymentStatus === 'settlement' && paymentStatus !== 'settlement') {
      return {
        success: true,
        message: `Pembayaran ${clean} sudah settlement; status lama diabaikan.`,
        reservation: this.mapPrismaReservation(target),
      };
    }

    if (
      target.paymentStatus === paymentStatus &&
      (!paymentMethod || target.paymentMethod === paymentMethod) &&
      (amount === undefined || Number(target.paymentAmount) === amount)
    ) {
      return {
        success: true,
        message: `Notifikasi pembayaran ${clean} sudah diproses.`,
        reservation: this.mapPrismaReservation(target),
      };
    }

    const updateData: any = { paymentStatus };
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (amount !== undefined && amount > 0) updateData.paymentAmount = amount;
    if (paymentStatus === 'settlement') {
      updateData.paymentPaidAt = new Date();
      if (target.status === 'pending') {
        updateData.status = 'confirmed';
      }
    } else if (paymentStatus === 'expire' || paymentStatus === 'cancel') {
      if (target.status === 'pending') {
        updateData.status = 'cancelled';
        updateData.rejectionReason = `Pembayaran ${paymentStatus}`;
      }
    }

    const updated = await prisma.reservation.update({
      where: { id: target.id },
      data: updateData,
    });

    await this.recordAudit({
      tenantId,
      actor,
      action: 'UPDATE_PAYMENT_STATUS',
      entity: `Tiket ${clean}`,
      details: `Status pembayaran diubah ke "${paymentStatus}" via ${paymentMethod || 'Gateway'} (Rp ${(amount || target.paymentAmount || 0).toLocaleString('id-ID')})`,
    });

    return {
      success: true,
      message: `Status pembayaran ${clean} berhasil diupdate ke ${paymentStatus}.`,
      reservation: this.mapPrismaReservation(updated),
    };
  }

  /**
   * 19. Get Audit Events
   */
  public static async getAuditEvents(tenantId: TenantId, limit: number = 50): Promise<AuditEvent[]> {
    const events = await prisma.auditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return events.map((e) => ({
      id: e.id,
      actor: e.actor,
      action: e.action,
      entity: e.entity,
      target: e.entity,
      timestamp: e.createdAt.toISOString(),
      details: e.details || '',
      tenantId: e.tenantId,
    }));
  }

  /**
   * 20. Record Audit Event Helper
   */
  public static async recordAudit(params: {
    tenantId: TenantId;
    actor: string;
    action: string;
    entity: string;
    details?: string;
  }): Promise<void> {
    try {
      await prisma.auditEvent.create({
        data: {
          tenantId: params.tenantId,
          actor: params.actor,
          action: params.action,
          entity: params.entity,
          details: params.details,
        },
      });
    } catch (err) {
      console.warn('[PrismaRestaurantRepository] Failed to record audit event:', err);
    }
  }

  /**
   * 21. Update Payment Status by Code (Auto resolves tenant across multi-tenant SaaS)
   */
  public static async updatePaymentStatusByCode(
    code: string,
    paymentStatus: PaymentStatus,
    paymentMethod?: string,
    amount?: number,
    actor: string = 'Midtrans Webhook'
  ): Promise<{ success: boolean; message: string; reservation?: Reservation; tenantId?: TenantId }> {
    const clean = code.trim().toUpperCase();
    const target = await prisma.reservation.findFirst({
      where: {
        code: { equals: clean, mode: 'insensitive' },
      },
    });

    if (!target) {
      return {
        success: false,
        message: `Reservasi dengan kode "${code}" tidak ditemukan di database.`,
      };
    }

    if (!isExpectedPaymentAmount(target, amount)) {
      return {
        success: false,
        message: `Nominal Midtrans tidak cocok. Tagihan: Rp ${getExpectedPaymentAmount(target).toLocaleString('id-ID')}.`,
        tenantId: target.tenantId,
      };
    }

    const updateRes = await this.updatePaymentStatus(
      target.tenantId,
      target.code,
      paymentStatus,
      paymentMethod,
      amount,
      actor
    );

    return {
      ...updateRes,
      tenantId: target.tenantId,
    };
  }

  public static async setSnapTokenByCode(code: string, snapToken: string): Promise<void> {
    await prisma.reservation.update({
      where: { code: code.trim().toUpperCase() },
      data: { snapToken },
    });
  }

  /**
   * 22. Get All Active Tenants from Database
   */
  public static async getAllTenants() {
    return await prisma.restaurant.findMany({
      select: {
        id: true,
        tenantId: true,
        name: true,
        tagline: true,
        address: true,
        city: true,
        phone: true,
        openingHours: true,
        openTime: true,
        closeTime: true,
        description: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 23. Lookup Reservation by Code across Tenants
   */
  public static async lookupReservation(code: string): Promise<Reservation | null> {
    const clean = code.trim().toUpperCase();
    const target = await prisma.reservation.findFirst({
      where: {
        code: { equals: clean, mode: 'insensitive' },
      },
    });

    if (!target) return null;
    return this.mapPrismaReservation(target);
  }
}
