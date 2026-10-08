import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createSnapTransaction,
  getExpectedPaymentAmount,
  getMidtransConfig,
  isExpectedPaymentAmount,
} from '../../../../lib/midtrans';
import { PrismaRestaurantRepository } from '../../../../lib/db/prisma-repository';

const PaymentTokenRequestSchema = z.object({
  orderId: z.string().trim().min(1, 'orderId (Kode Reservasi) wajib diisi.'),
  amount: z.coerce.number().positive('Nominal pembayaran (amount) harus lebih besar dari 0.'),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = PaymentTokenRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(
        { success: false, message: errorMsg },
        { status: 400 }
      );
    }

    const { orderId, amount: requestedAmount } = parseResult.data;
    const reservation = await PrismaRestaurantRepository.lookupReservation(orderId);

    if (!reservation) {
      return NextResponse.json(
        { success: false, message: `Pesanan ${orderId} tidak ditemukan di PostgreSQL.` },
        { status: 404 }
      );
    }

    if (reservation.paymentStatus === 'settlement') {
      return NextResponse.json(
        { success: false, message: `Pesanan ${orderId} sudah lunas.` },
        { status: 409 }
      );
    }

    if (!isExpectedPaymentAmount(reservation, requestedAmount)) {
      return NextResponse.json(
        {
          success: false,
          message: `Nominal pembayaran tidak cocok. Tagihan: Rp ${getExpectedPaymentAmount(reservation).toLocaleString('id-ID')}.`,
        },
        { status: 400 }
      );
    }

    const grossAmount = getExpectedPaymentAmount(reservation);

    const config = getMidtransConfig();

    // Call Midtrans Snap API
    const snapResult = await createSnapTransaction({
      orderId,
      grossAmount,
      customerDetails: {
        firstName: reservation.customerName,
        phone: reservation.customerPhone === '-' ? undefined : reservation.customerPhone,
      },
      itemDetails: [
        {
          id: `DEP-${orderId}`,
          name: `Pembayaran Pesanan (${orderId})`,
          price: grossAmount,
          quantity: 1,
        },
      ],
      notes: reservation.notes,
    });

    await PrismaRestaurantRepository.setSnapTokenByCode(orderId, snapResult.token);

    return NextResponse.json({
      success: true,
      orderId,
      amount: grossAmount,
      token: snapResult.token,
      redirectUrl: snapResult.redirect_url,
      snapUrl: config.snapUrl,
      clientKey: config.clientKey,
      isProduction: config.isProduction,
      message: 'Snap Token berhasil dibuat.',
    });
  } catch (error: any) {
    console.error('Error generating Midtrans Snap token:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Terjadi kesalahan saat memproses Snap Token.',
      },
      { status: 500 }
    );
  }
}
