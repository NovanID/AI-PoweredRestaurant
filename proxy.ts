import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME } from './lib/auth/constants';

/**
 * Optimistic auth gate for the admin surface (Next.js 16 Proxy, formerly Middleware).
 * This only checks cookie PRESENCE to redirect/block early — the actual HMAC
 * verification + tenant claim enforcement happens inside each route handler and
 * the admin server page (proxy must never be the sole authorization layer).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(ADMIN_COOKIE_NAME)?.value);

  const isApiAdmin = pathname.startsWith('/api/admin/');
  const isLoginRoute = pathname === '/api/admin/login' || pathname === '/admin/login';

  if (isLoginRoute) return NextResponse.next();

  if (isApiAdmin) {
    if (!hasSessionCookie) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi admin diperlukan.' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // /admin pages
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!hasSessionCookie) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
