import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  getAdminSession,
  signAdminSession,
} from '../../../../lib/auth/admin-session';
import { TENANT_BRANDING } from '../../../../lib/tenants';

export const dynamic = 'force-dynamic';

/**
 * Switch the active tenant of an authenticated admin session.
 * The new tenantId is re-signed into the HMAC cookie — clients cannot forge it.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: 'Autentikasi admin diperlukan.' },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const tenantId = String(body.tenantId || '').trim();

  if (!TENANT_BRANDING[tenantId]) {
    return NextResponse.json(
      { success: false, message: `Tenant "${tenantId}" tidak dikenal.` },
      { status: 400 }
    );
  }

  const token = signAdminSession(tenantId, session.user);
  const res = NextResponse.json({ success: true, tenantId });
  res.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions());
  return res;
}
