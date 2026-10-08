/**
 * Admin session authentication.
 *
 * Lightweight HMAC-signed cookie sessions (no external auth library).
 * The tenantId is embedded in the signed claim — admin API routes MUST derive
 * the tenant from this claim, never from request body/query.
 *
 * Requires ADMIN_SESSION_SECRET in the environment. ADMIN_PASSWORD protects login.
 */
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_MS } from './constants';

export { ADMIN_COOKIE_NAME };
const SESSION_TTL_MS = ADMIN_SESSION_TTL_MS;

function getSecret(): string {
  const secret = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (!secret) {
    // Fail closed in production; allow dev with an ephemeral per-process secret.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_SESSION_SECRET wajib di-set di environment production.');
    }
    console.warn('[admin-session] ADMIN_SESSION_SECRET belum di-set — memakai secret dev sementara (session hilang saat restart).');
    const g = globalThis as any;
    if (!g.__adminDevSecret) g.__adminDevSecret = crypto.randomBytes(32).toString('hex');
    return g.__adminDevSecret;
  }
  return secret;
}

export interface AdminSessionPayload {
  tenantId: string;
  user: string;
  iat: number;
  exp: number;
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function signAdminSession(tenantId: string, user: string): string {
  const now = Date.now();
  const payload: AdminSessionPayload = { tenantId, user, iat: now, exp: now + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(body)}`;
}

export function verifyAdminSession(token: string | undefined | null): AdminSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = hmac(body);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AdminSessionPayload;
    if (!payload.tenantId || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAdminPassword(): string {
  return (process.env.ADMIN_PASSWORD || '').trim() || 'admin123';
}

export function getAdminUsername(): string {
  return (process.env.ADMIN_USERNAME || '').trim() || 'admin';
}

/** Read + verify the admin session from the incoming request cookies (server components & route handlers). */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE_NAME)?.value);
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
