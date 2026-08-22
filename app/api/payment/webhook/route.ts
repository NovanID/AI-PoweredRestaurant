import { NextRequest, NextResponse } from 'next/server';
import { verifyMidtransSignature, mapMidtransStatus } from '../../../../lib/midtrans';
import { restaurantStore } from '../../../../lib/restaurant-store';

// GET handler for healthcheck / URL validation by web crawlers/testing tools
export async function GET() {
  return NextResponse.json({
    status: 'OK',
    message: 'Midtrans Payment Webhook endpoint is active and listening.',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
      transaction_time,
      settlement_time,
    } = payload;

    // Handle Midtrans Dashboard "Test Notification URL" simulation
    if (
      !order_id ||
      (typeof order_id === 'string' &&
        (order_id.startsWith('payment_notif_test') ||
          order_id.includes('test_notif') ||
          order_id.includes('dummy')))
    ) {
      console.log(`[Midtrans Webhook] Received Dashboard Test Notification: ${order_id}`);
      return NextResponse.json({
        status_code: '200',
        status_message: 'Test notification received and verified successfully.',
      });
    }

    // 1. Validate required webhook payload attributes
    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return NextResponse.json(
        {
          success: false,
          message: 'Payload webhook tidak lengkap. Dibutuhkan order_id, status_code, gross_amount, signature_key.',
        },
        { status: 400 }
      );
    }

    // 2. Verify SHA512 Signature Key
    const isSignatureValid = verifyMidtransSignature({
      orderId: order_id,
      statusCode: status_code,
      grossAmount: gross_amount,
      signatureKey: signature_key,
    });

    if (!isSignatureValid) {
      console.warn(`[Midtrans Webhook] Invalid signature key for Order ${order_id}`);
      return NextResponse.json(
        {
          success: false,
          message: 'Verifikasi signature_key gagal. Permintaan ditolak.',
        },
        { status: 401 }
      );
    }

    // 3. Map status to restaurant domain state
    const statusMapping = mapMidtransStatus(transaction_status, fraud_status);

    console.log(
      `[Midtrans Webhook] Verified notification for Order ${order_id} | Status: ${transaction_status} | Mapped: ${statusMapping.paymentStatus} (${statusMapping.reservationStatus})`
    );

    // 4. Update in-memory / persistent restaurant store
    const updateResult = restaurantStore.updatePaymentStatus(
      order_id,
      statusMapping.paymentStatus,
      payment_type || 'midtrans',
      parseFloat(gross_amount),
      `Midtrans Webhook (${payment_type || 'Gateway'})`
    );

    return NextResponse.json({
      success: true,
      message: 'Notifikasi Midtrans berhasil diverifikasi dan diproses.',
      data: {
        orderId: order_id,
        transactionStatus: transaction_status,
        fraudStatus: fraud_status,
        paymentStatus: statusMapping.paymentStatus,
        reservationStatus: statusMapping.reservationStatus,
        paymentType: payment_type,
        settlementTime: settlement_time || transaction_time,
        storeUpdated: updateResult.success,
      },
    });
  } catch (error: any) {
    console.error('[Midtrans Webhook] Error processing notification:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Terjadi kesalahan pada server saat memproses webhook.',
      },
      { status: 500 }
    );
  }
}
