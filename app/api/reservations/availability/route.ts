import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaRestaurantRepository } from '../../../../lib/db/prisma-repository';
import { resolveTenantSlug, DEFAULT_TENANT_ID } from '../../../../lib/tenants';
import { rateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  tenantId: z.string().optional(),
  slug: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  guestCount: z.coerce.number().int().min(1).max(30),
  preferredArea: z.enum(['Indoor', 'Outdoor', 'VIP']).optional(),
});

/**
 * PUBLIC availability check backed by PostgreSQL + Redis holds.
 * Replaces the client-side local-state check in the reservation form.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const limit = rateLimit(`avail:${ip}`, 60, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak permintaan.' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }
    const q = parsed.data;
    const tenantId = resolveTenantSlug(q.tenantId || q.slug || '') || DEFAULT_TENANT_ID;

    const result = await PrismaRestaurantRepository.checkAvailability({
      tenantId,
      date: q.date,
      time: q.time,
      guestCount: q.guestCount,
      preferredArea: q.preferredArea,
    });

    return NextResponse.json({
      success: true,
      available: result.available,
      availableTables: result.availableTables.map((t) => ({
        id: t.id,
        number: t.number,
        capacity: t.capacity,
        area: t.area,
      })),
      reason: result.reason,
    });
  } catch (error: any) {
    console.error('[Public Availability API] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengecek ketersediaan.' },
      { status: 500 }
    );
  }
}
