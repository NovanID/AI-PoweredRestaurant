import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaRestaurantRepository } from '../../../../lib/db/prisma-repository';
import { rateLimit } from '../../../../lib/rate-limit';
import { signManageToken, verifyPhoneHint, maskPhone } from '../../../../lib/auth/manage-token';

export const dynamic = 'force-dynamic';

const LookupSchema = z.object({
  code: z.string().trim().min(3, 'Kode reservasi wajib diisi.'),
  phoneHint: z.string().trim().optional(),
});

/**
 * PUBLIC reservation lookup — phone verification is enforced SERVER-SIDE.
 *
 * Flow:
 * 1. Client POSTs { code }.
 * 2. If the reservation has a registered phone, the server responds 403 with
 *    requiresPhone:true — no personal data is leaked.
 * 3. Client re-POSTs { code, phoneHint } (last-4 digits). On success the
 *    server returns the reservation (phone masked) + a short-lived signed
 *    manageToken used by /api/reservations/manage.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const body = await req.json().catch(() => ({}));
    const parsed = LookupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }
    const code = parsed.data.code.replace(/\s+/g, '').toUpperCase();

    // Brute-force throttle per IP+code (enumeration guard)
    const limit = rateLimit(`lookup:${ip}:${code}`, 8, 10 * 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak percobaan untuk kode ini. Coba lagi nanti.' },
        { status: 429 }
      );
    }

    const reservation = await PrismaRestaurantRepository.lookupReservation(code);
    if (!reservation) {
      return NextResponse.json(
        { success: false, message: `Reservasi dengan kode "${code}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    const hasRegisteredPhone =
      Boolean(reservation.customerPhone) &&
      reservation.customerPhone !== '-' &&
      reservation.customerPhone.replace(/\D/g, '').length >= 4;

    if (hasRegisteredPhone) {
      const hint = parsed.data.phoneHint || '';
      if (!verifyPhoneHint(reservation.customerPhone, hint)) {
        return NextResponse.json(
          {
            success: false,
            requiresPhone: true,
            message: hint
              ? 'Verifikasi gagal: 4 digit terakhir nomor WhatsApp tidak cocok.'
              : 'Masukkan 4 digit terakhir nomor WhatsApp terdaftar untuk melihat tiket ini.',
          },
          { status: 403 }
        );
      }
    }

    // Verified — issue a short-lived manage token for cancel/reschedule.
    const manageToken = signManageToken(reservation.code, reservation.tenantId);

    return NextResponse.json({
      success: true,
      source: 'postgresql',
      manageToken,
      data: {
        ...reservation,
        customerPhone: maskPhone(reservation.customerPhone),
        // never leak payment internals to the public surface
        snapToken: undefined,
      },
    });
  } catch (error: any) {
    console.error('[API Reservation Lookup] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mencari data reservasi.' },
      { status: 500 }
    );
  }
}
