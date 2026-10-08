import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaRestaurantRepository } from '../../../lib/db/prisma-repository';
import { resolveTenantSlug, DEFAULT_TENANT_ID, getTenantCodePrefix } from '../../../lib/tenants';
import { rateLimit } from '../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

const CreateReservationSchema = z.object({
  tenantId: z.string().optional(),
  slug: z.string().optional(),
  customerName: z.string().trim().min(2, 'Nama wajib diisi minimal 2 karakter.'),
  customerPhone: z.string().trim().min(6, 'Nomor WhatsApp wajib diisi.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam harus HH:mm.'),
  guestCount: z.coerce.number().int().min(1).max(30),
  preferredArea: z.enum(['Indoor', 'Outdoor', 'VIP']).optional(),
  notes: z.string().max(500).optional(),
  payDepositNow: z.boolean().optional(),
  paymentAmount: z.coerce.number().min(0).optional(),
});

/**
 * PUBLIC customer reservation endpoint (storefront form).
 * Server-side availability check + atomic DB insert + server-generated code.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const limit = rateLimit(`res-create:${ip}`, 12, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const tenantId =
      resolveTenantSlug(data.tenantId || data.slug || '') || DEFAULT_TENANT_ID;

    const profile = await PrismaRestaurantRepository.getProfile(tenantId);
    if (!profile) {
      return NextResponse.json(
        { success: false, message: `Tenant "${tenantId}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    // Server-side availability check against PostgreSQL (+ Redis holds)
    const avail = await PrismaRestaurantRepository.checkAvailability({
      tenantId,
      date: data.date,
      time: data.time,
      guestCount: data.guestCount,
      preferredArea: data.preferredArea,
    });

    if (!avail.available || avail.availableTables.length === 0) {
      return NextResponse.json({
        success: false,
        message: avail.reason || 'Ketersediaan meja tidak mencukupi untuk waktu yang dipilih.',
      });
    }

    // Pick best matching table (smallest capacity that fits)
    const selectedTable = [...avail.availableTables].sort((a, b) => a.capacity - b.capacity)[0];

    const prefix = getTenantCodePrefix(tenantId);
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `${prefix}-${randomChars}`;

    const depositAmount = data.payDepositNow ? data.paymentAmount || 50000 : 0;

    const reservation = await PrismaRestaurantRepository.createReservation({
      tenantId,
      code,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      tableId: selectedTable.id,
      tableNumber: selectedTable.number,
      tableArea: selectedTable.area,
      date: data.date,
      time: data.time,
      guestCount: data.guestCount,
      notes: data.notes,
      paymentStatus: depositAmount > 0 ? 'pending' : 'unpaid',
      paymentAmount: depositAmount > 0 ? depositAmount : undefined,
    });

    await PrismaRestaurantRepository.recordAudit({
      tenantId,
      actor: 'Web Customer',
      action: 'CREATE_RESERVATION',
      entity: `Reservasi ${code}`,
      details: `Reservasi Meja ${selectedTable.number} untuk ${data.customerName} (${data.guestCount} orang) via storefront.`,
    });

    return NextResponse.json({
      success: true,
      message: `Reservasi berhasil dikonfirmasi otomatis oleh sistem dengan kode ${code}. Meja Anda telah terkunci!`,
      reservation,
    });
  } catch (error: any) {
    console.error('[Public Reservations API] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses reservasi di server.' },
      { status: 500 }
    );
  }
}
