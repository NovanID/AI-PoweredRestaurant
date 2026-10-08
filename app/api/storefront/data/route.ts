import { NextRequest, NextResponse } from 'next/server';
import { PrismaRestaurantRepository } from '../../../../lib/db/prisma-repository';
import { resolveTenantSlug, DEFAULT_TENANT_ID } from '../../../../lib/tenants';

export const dynamic = 'force-dynamic';

/**
 * PUBLIC storefront data: profile, menu, tables only.
 * Never exposes reservations, customers, or audit events.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('tenantId') || searchParams.get('slug') || DEFAULT_TENANT_ID;
    const tenantId = resolveTenantSlug(raw);

    if (!tenantId) {
      return NextResponse.json(
        { success: false, message: `Tenant "${raw}" tidak dikenali.` },
        { status: 404 }
      );
    }

    const [profile, menu, tables] = await Promise.all([
      PrismaRestaurantRepository.getProfile(tenantId),
      PrismaRestaurantRepository.getMenuItems({ tenantId }),
      PrismaRestaurantRepository.getTables(tenantId),
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
      data: { profile, menu, tables },
    });
  } catch (error: any) {
    console.error('[Storefront API] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data storefront.' },
      { status: 500 }
    );
  }
}
