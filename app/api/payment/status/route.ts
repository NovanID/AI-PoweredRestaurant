import { NextRequest, NextResponse } from 'next/server';
import { getMidtransTransactionStatus } from '../../../../lib/midtrans';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: 'Parameter orderId wajib disertakan.' },
        { status: 400 }
      );
    }

    const statusData = await getMidtransTransactionStatus(orderId);
    return NextResponse.json({
      success: true,
      orderId,
      data: statusData,
    });
  } catch (error: any) {
    console.error('Error fetching Midtrans transaction status:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal mengambil status transaksi dari Midtrans.',
      },
      { status: 500 }
    );
  }
}
