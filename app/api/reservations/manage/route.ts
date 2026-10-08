import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaRestaurantRepository } from '../../../../lib/db/prisma-repository';
import { verifyManageToken } from '../../../../lib/auth/manage-token';
import { rateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

const ManageSchema = z.object({
  code: z.string().trim().min(3),
  manageToken: z.string().trim().min(10, 'Sesi verifikasi telah habis. Cari ulang kode reservasi Anda.'),
  action: z.enum(['cancel', 'reschedule']),
  reason: z.string().max(300).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  guestCount: z.coerce.number().int().min(1).max(30).optional(),
});

/**
 * PUBLIC customer self-service: cancel / reschedule a reservation.
 * Requires a valid signed manageToken previously issued by the lookup route
 * (which enforces the phone check server-side). Tenant comes from the token.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const body = await req.json().catch(() => ({}));
    const parsed = ManageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }
    const { code, manageToken, action, reason, date, time, guestCount } = parsed.data;

    const limit = rateLimit(`manage:${ip}`, 20, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
        { status: 429 }
      );
    }

    const tokenPayload = verifyManageToken(manageToken, code);
    if (!tokenPayload) {
      return NextResponse.json(
        { success: false, message: 'Sesi verifikasi tidak valid atau telah habis. Silakan lacak ulang kode reservasi Anda.' },
        { status: 403 }
      );
    }
    const tenantId = tokenPayload.tenantId;
    const actor = 'Customer (Self-Service)';

    if (action === 'cancel') {
      const res = await PrismaRestaurantRepository.cancelReservation(
        tenantId,
        code,
        reason?.trim() || 'Dibatalkan mandiri oleh customer'
      );
      if (!res.success) {
        return NextResponse.json(res);
      }
      await PrismaRestaurantRepository.recordAudit({
        tenantId,
        actor,
        action: 'CANCEL_RESERVATION',
        entity: `Tiket ${code.toUpperCase()}`,
        details: reason?.trim() || 'Dibatalkan mandiri oleh customer via web.',
      });
      return NextResponse.json({ ...res, actor });
    }

    // action === 'reschedule'
    if (!date || !time) {
      return NextResponse.json(
        { success: false, message: 'Tanggal dan jam baru wajib diisi untuk reschedule.' },
        { status: 400 }
      );
    }

    const res = await PrismaRestaurantRepository.rescheduleReservation(tenantId, code, {
      newDate: date,
      newTime: time,
      newGuestCount: guestCount,
      actor,
    });

    if (!res.success) {
      return NextResponse.json(res);
    }

    return NextResponse.json({
      ...res,
      message: `${res.message} Menunggu konfirmasi ulang staf.`,
    });
  } catch (error: any) {
    console.error('[Public Reservations Manage] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses permintaan di server.' },
      { status: 500 }
    );
  }
}
