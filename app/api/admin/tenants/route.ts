import { NextResponse } from 'next/server';
import { PrismaRestaurantRepository } from '../../../../lib/db/prisma-repository';
import { AVAILABLE_TENANTS } from '../../../../lib/mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbTenants = await PrismaRestaurantRepository.getAllTenants().catch(() => []);

    if (dbTenants.length > 0) {
      // Merge with metadata from AVAILABLE_TENANTS
      const enriched = dbTenants.map((t) => {
        const meta = AVAILABLE_TENANTS.find((m) => m.id === t.tenantId);
        return {
          id: t.tenantId,
          tenantId: t.tenantId,
          name: t.name,
          tagline: t.tagline,
          address: t.address,
          city: t.city,
          phone: t.phone,
          openingHours: t.openingHours,
          openTime: t.openTime,
          closeTime: t.closeTime,
          category: meta?.category || 'Restoran & Kuliner',
          themeColor: meta?.themeColor || '#8f1d20',
        };
      });

      return NextResponse.json({
        success: true,
        data: enriched,
        source: 'postgresql',
      });
    }

    return NextResponse.json({
      success: true,
      data: AVAILABLE_TENANTS,
      source: 'fallback',
    });
  } catch (err: any) {
    console.error('[API Tenants] Error fetching tenants:', err);
    return NextResponse.json(
      {
        success: false,
        message: err.message || 'Gagal mengambil daftar tenant.',
        data: AVAILABLE_TENANTS,
      },
      { status: 500 }
    );
  }
}
