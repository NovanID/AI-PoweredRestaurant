import { NextRequest, NextResponse } from 'next/server';
import { PrismaRestaurantRepository } from '../../../../lib/db/prisma-repository';
import { DEFAULT_TENANT_ID } from '../../../../lib/mock-data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || DEFAULT_TENANT_ID;

    // Fetch all admin state concurrently from PostgreSQL
    const [profile, tables, menu, reservations, auditEvents] = await Promise.all([
      PrismaRestaurantRepository.getProfile(tenantId),
      PrismaRestaurantRepository.getTables(tenantId),
      PrismaRestaurantRepository.getMenuItems({ tenantId }),
      PrismaRestaurantRepository.getAllReservations(tenantId),
      PrismaRestaurantRepository.getAuditEvents(tenantId, 50),
    ]);

    if (!profile) {
      return NextResponse.json(
        { success: false, message: `Tenant "${tenantId}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      source: 'postgresql',
      tenantId,
      data: { profile, tables, menu, reservations, auditEvents },
    });
  } catch (error: any) {
    console.error('[Admin API Data] Error fetching admin state from DB:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal mengambil data admin dari database PostgreSQL.',
      },
      { status: 500 }
    );
  }
}
