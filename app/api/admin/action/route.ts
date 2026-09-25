import { NextRequest, NextResponse } from 'next/server';
import { PrismaRestaurantRepository } from '../../../../lib/db/prisma-repository';
import { DEFAULT_TENANT_ID } from '../../../../lib/mock-data';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, tenantId = DEFAULT_TENANT_ID, ...payload } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, message: 'Field action wajib disertakan.' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'UPDATE_RESERVATION_STATUS': {
        const { code, status, actor, reason } = payload;
        const res = await PrismaRestaurantRepository.updateReservationStatus(
          tenantId,
          code,
          status,
          actor,
          reason
        );
        return NextResponse.json(res);
      }

      case 'UPDATE_TABLE_STATUS': {
        const { tableId, status, actor } = payload;
        const res = await PrismaRestaurantRepository.updateTableStatus(
          tenantId,
          tableId,
          status,
          actor
        );
        return NextResponse.json(res);
      }

      case 'WALK_IN_SEATED': {
        const { tableId, guestCount, actor, code } = payload;
        const res = await PrismaRestaurantRepository.createWalkInSeated(tenantId, {
          tableId,
          guestCount,
          actor,
          code,
        });
        return NextResponse.json(res);
      }

      case 'MANUAL_BOOKING': {
        const res = await PrismaRestaurantRepository.createManualOfflineBooking(
          tenantId,
          payload
        );
        return NextResponse.json(res);
      }

      case 'CREATE_RESERVATION': {
        const { reservation, actor } = payload;
        const res = await PrismaRestaurantRepository.createReservation({
          tenantId,
          code: reservation.code,
          customerName: reservation.customerName,
          customerPhone: reservation.customerPhone || '-',
          tableId: reservation.tableId,
          tableNumber: reservation.tableNumber,
          tableArea: reservation.tableArea,
          date: reservation.date,
          time: reservation.time,
          guestCount: reservation.guestCount,
          notes: reservation.notes,
          paymentStatus: reservation.paymentStatus || 'unpaid',
          paymentAmount: reservation.paymentAmount,
          snapToken: reservation.snapToken,
        });

        await PrismaRestaurantRepository.recordAudit({
          tenantId,
          actor: actor || 'Web Customer',
          action: 'CREATE_RESERVATION',
          entity: `Reservasi ${res.code}`,
          details: `Reservasi Meja ${res.tableNumber} untuk ${res.customerName} (${res.guestCount} orang).`,
        });

        return NextResponse.json({
          success: true,
          message: `Reservasi ${res.code} berhasil disimpan ke PostgreSQL.`,
          reservation: res,
        });
      }

      case 'UPDATE_RESERVATION': {
        const { code, date, time, guestCount } = payload;
        const res = await PrismaRestaurantRepository.updateReservation(
          tenantId,
          code,
          { newDate: date, newTime: time, newGuestCount: guestCount }
        );
        return NextResponse.json(res);
      }

      case 'CANCEL_RESERVATION': {
        const { code, reason } = payload;
        const res = await PrismaRestaurantRepository.cancelReservation(tenantId, code, reason);
        return NextResponse.json(res);
      }

      case 'ADD_ORDER_ITEMS': {
        const { code, items, actor } = payload;
        const res = await PrismaRestaurantRepository.addOrderItemsToReservation(
          tenantId,
          code,
          items,
          actor
        );
        return NextResponse.json(res);
      }

      case 'SETTLE_PAYMENT': {
        const { code, paymentMethod, actor } = payload;
        const res = await PrismaRestaurantRepository.settleOfflinePayment(
          tenantId,
          code,
          paymentMethod,
          actor
        );
        return NextResponse.json(res);
      }

      case 'MARK_SEATED': {
        const { code, actor } = payload;
        const res = await PrismaRestaurantRepository.markAsSeated(tenantId, code, actor);
        return NextResponse.json(res);
      }

      case 'MARK_COMPLETED': {
        const { code, actor } = payload;
        const res = await PrismaRestaurantRepository.markAsCompleted(tenantId, code, actor);
        return NextResponse.json(res);
      }

      case 'MARK_NO_SHOW': {
        const { code, actor, reason } = payload;
        const res = await PrismaRestaurantRepository.markAsNoShow(tenantId, code, actor, reason);
        return NextResponse.json(res);
      }

      case 'TOGGLE_MENU': {
        const { id, actor } = payload;
        const res = await PrismaRestaurantRepository.toggleMenuItemAvailability(
          tenantId,
          id,
          actor
        );
        return NextResponse.json(res);
      }

      default:
        return NextResponse.json(
          { success: false, message: `Aksi "${action}" tidak dikenali.` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Admin API Action] Error executing admin action:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses aksi admin di server.' },
      { status: 500 }
    );
  }
}
