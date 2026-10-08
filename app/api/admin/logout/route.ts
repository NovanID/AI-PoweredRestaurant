import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '../../../../lib/auth/admin-session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}
