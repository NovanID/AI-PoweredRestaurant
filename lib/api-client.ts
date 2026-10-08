"use client";

/**
 * Typed fetch helpers for all public + admin API endpoints.
 * Admin calls rely on the httpOnly session cookie (same-origin fetch sends it
 * automatically).
 */
import type {
  RestaurantProfile,
  Table,
  MenuItem,
  Reservation,
  AuditEvent,
} from '../types/restaurant';

export interface AdminBundle {
  profile: RestaurantProfile;
  tables: Table[];
  menu: MenuItem[];
  reservations: Reservation[];
  auditEvents: AuditEvent[];
}

export interface StorefrontBundle {
  profile: RestaurantProfile;
  menu: MenuItem[];
  tables: Table[];
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const err: any = new Error(body.message || 'HTTP ' + res.status);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

// ---------- Admin ----------

export async function adminLogin(username: string, password: string, tenantId: string) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, tenantId }),
  });
  return jsonOrThrow<{ success: boolean; tenantId: string; user: string }>(res);
}

export async function adminLogout() {
  await fetch('/api/admin/logout', { method: 'POST' });
}

export async function adminSwitchTenant(tenantId: string) {
  const res = await fetch('/api/admin/switch-tenant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId }),
  });
  return jsonOrThrow<{ success: boolean; tenantId: string }>(res);
}

export async function adminFetchData(): Promise<AdminBundle> {
  const res = await fetch('/api/admin/data', { cache: 'no-store' });
  const json = await jsonOrThrow<{ data: AdminBundle; tenantId: string }>(res);
  return json.data;
}

export async function adminAction(action: string, payload: Record<string, any>) {
  const res = await fetch('/api/admin/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // tenantId intentionally NOT sent — server derives it from the session claim
    body: JSON.stringify({ action, ...payload }),
  });
  return jsonOrThrow<any>(res);
}

// ---------- Storefront (public) ----------

export async function storefrontFetchData(tenantId: string): Promise<StorefrontBundle> {
  const url = '/api/storefront/data?tenantId=' + encodeURIComponent(tenantId);
  const res = await fetch(url, { cache: 'no-store' });
  const json = await jsonOrThrow<{ data: StorefrontBundle }>(res);
  return json.data;
}

export interface AvailabilityResult {
  available: boolean;
  availableTables: Array<{ id: string; number: string; capacity: number; area: string }>;
  reason?: string;
}

export async function checkAvailabilityRemote(params: {
  tenantId: string;
  date: string;
  time: string;
  guestCount: number;
  preferredArea?: string;
}): Promise<AvailabilityResult> {
  const q = new URLSearchParams({
    tenantId: params.tenantId,
    date: params.date,
    time: params.time,
    guestCount: String(params.guestCount),
  });
  if (params.preferredArea) q.set('preferredArea', params.preferredArea);
  const res = await fetch('/api/reservations/availability?' + q.toString(), { cache: 'no-store' });
  return jsonOrThrow<AvailabilityResult>(res);
}

export async function createReservationRemote(data: {
  tenantId: string;
  customerName: string;
  customerPhone: string;
  date: string;
  time: string;
  guestCount: number;
  preferredArea?: string;
  notes?: string;
  payDepositNow?: boolean;
  paymentAmount?: number;
}): Promise<{ success: boolean; message: string; reservation: Reservation }> {
  const res = await fetch('/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return jsonOrThrow<{ success: boolean; message: string; reservation: Reservation }>(res);
}

export interface LookupResult {
  success: boolean;
  data: Reservation;
  manageToken: string;
}

export async function lookupReservationRemote(
  code: string,
  phoneHint?: string
): Promise<LookupResult> {
  const res = await fetch('/api/reservations/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, phoneHint }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const err: any = new Error(body.message || 'HTTP ' + res.status);
    err.status = res.status;
    err.requiresPhone = Boolean(body.requiresPhone);
    throw err;
  }
  return body as LookupResult;
}

export async function manageReservationRemote(params: {
  code: string;
  manageToken: string;
  action: 'cancel' | 'reschedule';
  reason?: string;
  date?: string;
  time?: string;
  guestCount?: number;
}): Promise<{ success: boolean; message: string; reservation?: Reservation }> {
  const res = await fetch('/api/reservations/manage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return jsonOrThrow<{ success: boolean; message: string; reservation?: Reservation }>(res);
}
