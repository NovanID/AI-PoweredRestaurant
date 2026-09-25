import { NextRequest, NextResponse } from 'next/server';
import { PrismaRestaurantRepository } from '../../../../lib/db/prisma-repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code || !code.trim()) {
      return NextResponse.json(
        { success: false, message: 'Parameter code wajib disertakan.' },
        { status: 400 }
      );
    }

    const reservation = await PrismaRestaurantRepository.lookupReservation(code.trim());

    if (!reservation) {
      return NextResponse.json(
        {
          success: false,
          message: `Reservasi dengan kode "${code}" tidak ditemukan.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: reservation,
      source: 'postgresql',
    });
  } catch (error: any) {
    console.error('[API Reservation Lookup] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mencari data reservasi.' },
      { status: 500 }
    );
  }
}
