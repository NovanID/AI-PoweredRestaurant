import { NextRequest, NextResponse } from 'next/server';
import { createSnapTransaction, getMidtransConfig } from '../../../../lib/midtrans';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, amount, customerName, customerPhone, customerEmail, notes, itemDetails } = body;

    // Validate required inputs
    if (!orderId) {
      return NextResponse.json(
        { success: false, message: 'orderId (Kode Reservasi) wajib diisi.' },
        { status: 400 }
      );
    }

    const grossAmount = Number(amount);
    if (!grossAmount || grossAmount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Nominal pembayaran (amount) harus lebih besar dari 0.' },
        { status: 400 }
      );
    }

    const config = getMidtransConfig();

    // Call Midtrans Snap API
    const snapResult = await createSnapTransaction({
      orderId,
      grossAmount,
      customerDetails: {
        firstName: customerName || 'Pelanggan Raso Minang',
        phone: customerPhone || undefined,
        email: customerEmail || 'customer@rasominang.com',
      },
      itemDetails: itemDetails || [
        {
          id: `DEP-${orderId}`,
          name: `Deposit Meja (${orderId})`,
          price: grossAmount,
          quantity: 1,
        },
      ],
      notes,
    });

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
