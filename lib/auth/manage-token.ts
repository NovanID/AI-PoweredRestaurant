/**
 * Signed manage-tokens for customer self-service operations
 * (cancel / reschedule a reservation after phone verification).
 *
 * Short-lived HMAC tokens — the phone check happens ONCE server-side,
 * then the token authorizes that specific reservation code for a limited time.
 */
import crypto from 'crypto';

const MANAGE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getSecret(): string {
  const secret = (process.env.ADMIN_SESSION_SECRET || process.env.MANAGE_TOKEN_SECRET || '').trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_SESSION_SECRET wajib di-set di environment production.');
    }
    const g = globalThis as any;
    if (!g.__manageDevSecret) g.__manageDevSecret = crypto.randomBytes(32).toString('hex');
    return g.__manageDevSecret;
  }
  return secret;
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function signManageToken(code: string, tenantId: string): string {
  const exp = Date.now() + MANAGE_TTL_MS;
  const body = Buffer.from(JSON.stringify({ code: code.toUpperCase(), tenantId, exp })).toString('base64url');
  return `${body}.${hmac(body)}`;
}

export function verifyManageToken(token: string | undefined | null, code: string): { tenantId: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  let expected: string;
  try {
    expected = hmac(body);
  } catch {
    return null;
  }
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.code || !payload.tenantId || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    if (String(payload.code).toUpperCase() !== code.trim().toUpperCase()) return null;
    return { tenantId: payload.tenantId };
  } catch {
    return null;
  }
}

/**
 * Server-side phone ownership check: the customer must know at least the
 * last 4 digits of the registered phone number.
 * Reservations created without a phone ('-') pass with the code alone.
 */
export function verifyPhoneHint(registeredPhone: string, phoneHint: string): boolean {
  const cleanRegistered = (registeredPhone || '').replace(/\D/g, '');
  if (!cleanRegistered || cleanRegistered.length < 4) return true; // no phone registered
  const cleanHint = (phoneHint || '').replace(/\D/g, '');
  if (cleanHint.length < 4) return false;
  return cleanRegistered.endsWith(cleanHint) || cleanRegistered === cleanHint;
}

export function maskPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (!clean || clean.length < 4 || clean === '') return phone || '-';
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}
