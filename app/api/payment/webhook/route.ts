import { NextRequest, NextResponse } from 'next/server';
import { verifyMidtransSignature, mapMidtransStatus } from '../../../../lib/midtrans';
import { PrismaRestaurantRepository } from '../../../../lib/db/prisma-repository';
import { DomainEventBus } from '../../../../lib/infrastructure/event-bus';

export const dynamic = 'force-dynamic';

// GET handler for healthcheck / URL validation by web crawlers/testing tools
export async function GET() {
  return NextResponse.json({
    status: 'OK',
    message: 'Midtrans Payment Webhook endpoint is active and listening with PostgreSQL synchronization.',
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
    if (!order_id || !status_code || !gross_amount || !signature_key || !transaction_status) {
      return NextResponse.json(
        {
          success: false,
          message: 'Payload webhook tidak lengkap.',
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

    const amount = Number(gross_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: 'gross_amount tidak valid.' }, { status: 400 });
    }

    // PostgreSQL is authoritative. A non-2xx response lets Midtrans retry failed notifications.
    const dbResult = await PrismaRestaurantRepository.updatePaymentStatusByCode(
      order_id,
      statusMapping.paymentStatus,
      payment_type || 'midtrans',
      amount,
      `Midtrans Webhook (${payment_type || 'Gateway'})`
    );

    if (!dbResult.success || !dbResult.reservation || !dbResult.tenantId) {
      return NextResponse.json(
        { success: false, message: dbResult.message },
        { status: 422 }
      );
    }

    console.log(
      `[Midtrans Webhook] Successfully updated PostgreSQL for order ${order_id} (Tenant: ${dbResult.tenantId})`
    );

    DomainEventBus.publish({
      eventType: 'payment.updated',
      tenantId: dbResult.tenantId,
      payload: {
        orderId: order_id,
        paymentStatus: statusMapping.paymentStatus,
        amount,
        paymentMethod: payment_type,
        reservation: dbResult.reservation,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notifikasi Midtrans berhasil diverifikasi dan diproses ke PostgreSQL.',
      data: {
        orderId: order_id,
        tenantId: dbResult.tenantId,
        transactionStatus: transaction_status,
        fraudStatus: fraud_status,
        paymentStatus: statusMapping.paymentStatus,
        reservationStatus: statusMapping.reservationStatus,
        paymentType: payment_type,
        settlementTime: settlement_time || transaction_time,
        dbUpdated: true,
        reservation: dbResult.reservation,
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
