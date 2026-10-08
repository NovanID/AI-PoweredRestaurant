import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  getAdminPassword,
  getAdminUsername,
  signAdminSession,
} from '../../../../lib/auth/admin-session';
import { DEFAULT_TENANT_ID } from '../../../../lib/mock-data';

export const dynamic = 'force-dynamic';

// Simple in-memory brute-force throttle: max 8 attempts / 10 minutes per IP
const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const now = Date.now();
    const entry = attempts.get(ip);
    if (entry && entry.resetAt > now && entry.count >= 8) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const tenantId = String(body.tenantId || DEFAULT_TENANT_ID).trim();

    const expectedUser = getAdminUsername();
    const expectedPass = getAdminPassword();

    const okUser = crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser));
    const okPass =
      password.length === expectedPass.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass));

    if (!username || !password || !okUser || !okPass) {
      const prev = attempts.get(ip);
      if (!prev || prev.resetAt <= now) {
        attempts.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
      } else {
        prev.count += 1;
      }
      return NextResponse.json(
        { success: false, message: 'Username atau password salah.' },
        { status: 401 }
      );
    }

    attempts.delete(ip);
    const token = signAdminSession(tenantId, username);
    const res = NextResponse.json({ success: true, tenantId, user: username });
    res.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions());
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses login.' },
      { status: 500 }
    );
  }
}
