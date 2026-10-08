"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  RestaurantProfile,
  Table,
  MenuItem,
  Reservation,
  AuditEvent,
  ReservationStatus,
  TableStatus,
  MenuCategory,
  TableArea,
} from '../types/restaurant';
import { DEFAULT_TENANT_ID, AVAILABLE_TENANTS } from './mock-data';
import { useTenant } from './tenant-context';
import {
  adminFetchData,
  adminAction,
  adminSwitchTenant,
  storefrontFetchData,
  createReservationRemote,
  checkAvailabilityRemote,
} from './api-client';

export type RestaurantHookMode = 'admin' | 'storefront';

interface Options {
  mode?: RestaurantHookMode;
}

const EMPTY_PROFILE: RestaurantProfile = {
  tenantId: DEFAULT_TENANT_ID,
  name: '...',
  tagline: '',
  address: '',
  city: '',
  phone: '',
  openingHours: '',
  openTime: '10:00',
  closeTime: '22:00',
  description: '',
  policies: [],
};

/**
 * Unified data hook.
 *
 * - mode 'admin' (default inside /admin): reads /api/admin/data with the signed
 *   session cookie; every mutation goes through /api/admin/action where the
 *   tenant is derived from the session claim server-side. PostgreSQL is the
 *   single source of truth — there is no local mock fallback anymore.
 *
 * - mode 'storefront': reads only the public /api/storefront/data (profile,
 *   menu, tables) for the tenant resolved from the URL (/t/[slug]); customer
 *   mutations go through the public reservation endpoints.
 */
export function useRestaurant(options: Options = {}) {
  const tenantCtx = useTenant();
  // Default mode is 'storefront'; AdminDashboard passes { mode: 'admin' }.
  const mode: RestaurantHookMode = options.mode || 'storefront';

  const initialTenantId = mode === 'storefront' ? tenantCtx.tenantId : DEFAULT_TENANT_ID;

  const [activeTenantId, setActiveTenantId] = useState<string>(initialTenantId);
  const [profile, setProfile] = useState<RestaurantProfile>({ ...EMPTY_PROFILE, tenantId: initialTenantId });
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [authError, setAuthError] = useState(false);
  const isFetchingRef = useRef(false);

  // Keep the active tenant in sync with the URL-resolved tenant (storefront)
  useEffect(() => {
    if (mode === 'storefront') setActiveTenantId(tenantCtx.tenantId);
  }, [mode, tenantCtx.tenantId]);

  const fetchData = useCallback(async (targetTenantId?: string) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (mode === 'admin') {
        const data = await adminFetchData();
        setProfile(data.profile);
        setTables(data.tables || []);
        setMenu(data.menu || []);
        setReservations(data.reservations || []);
        setAuditEvents(data.auditEvents || []);
        setIsDbConnected(true);
        setAuthError(false);
        if (data.profile?.tenantId) setActiveTenantId(data.profile.tenantId);
      } else {
        const tenant = targetTenantId || activeTenantId;
        const data = await storefrontFetchData(tenant);
        setProfile(data.profile);
        setMenu(data.menu || []);
        setTables(data.tables || []);
        setIsDbConnected(true);
      }
    } catch (err: any) {
      setIsDbConnected(false);
      if (mode === 'admin' && err?.status === 401) setAuthError(true);
      console.warn(`[useRestaurant:${mode}] fetch error:`, err?.message || err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [mode, activeTenantId]);

  useEffect(() => {
    setIsClient(true);
    void fetchData(activeTenantId);

    // Admin dashboard polls for realtime cashier sync; storefront fetches once.
    if (mode === 'admin') {
      const poll = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void fetchData();
        }
      }, 5000);
      return () => clearInterval(poll);
    }
  }, [mode, activeTenantId, fetchData]);

  /** Admin-only: switch tenant via signed session (server re-signs the cookie). */
  const setTenantId = useCallback(async (newTenantId: string) => {
    if (mode !== 'admin') {
      setActiveTenantId(newTenantId);
      void fetchData(newTenantId);
      return;
    }
    try {
      await adminSwitchTenant(newTenantId);
      setActiveTenantId(newTenantId);
      await fetchData();
    } catch (err: any) {
      if (err?.status === 401) setAuthError(true);
      throw err;
    }
  }, [mode, fetchData]);

  // ---------- Admin mutations (async, server-authoritative) ----------

  const runAdminAction = useCallback(async (action: string, payload: Record<string, any>) => {
    try {
      const res = await adminAction(action, payload);
      void fetchData();
      return res;
    } catch (err: any) {
      if (err?.status === 401) setAuthError(true);
      void fetchData();
      return { success: false, message: err?.message || `Aksi ${action} gagal diproses di server.` };
    }
  }, [fetchData]);

  const toggleMenuAvailability = useCallback(
    (id: string, actor?: string) => runAdminAction('TOGGLE_MENU', { id, actor }),
    [runAdminAction]
  );

  const updateTableStatus = useCallback(
    (id: string, status: TableStatus, actor?: string) =>
      runAdminAction('UPDATE_TABLE_STATUS', { tableId: id, status, actor }),
    [runAdminAction]
  );

  const updateReservationStatus = useCallback(
    (code: string, status: ReservationStatus, actor?: string, reason?: string) =>
      runAdminAction('UPDATE_RESERVATION_STATUS', { code, status, actor, reason }),
    [runAdminAction]
  );

  const createWalkInSeated = useCallback(
    (tableId: string, guestCount?: number, actor?: string, code?: string) =>
      runAdminAction('WALK_IN_SEATED', { tableId, guestCount, actor, code }),
    [runAdminAction]
  );

  const createManualOfflineBooking = useCallback(
    (data: {
      customerName: string;
      customerPhone?: string;
      tableId: string;
      guestCount: number;
      notes?: string;
      actionType: 'seated_now' | 'scheduled';
      date?: string;
      time?: string;
      actor?: string;
    }) => runAdminAction('MANUAL_BOOKING', { ...data }),
    [runAdminAction]
  );

  const addOrderItemsToReservation = useCallback(
    (code: string, items: any[], actor?: string) =>
      runAdminAction('ADD_ORDER_ITEMS', { code, items, actor }),
    [runAdminAction]
  );

  const settleOfflinePayment = useCallback(
    (code: string, paymentMethod?: string, actor?: string) =>
      runAdminAction('SETTLE_PAYMENT', { code, paymentMethod, actor }),
    [runAdminAction]
  );

  const markAsSeated = useCallback(
    (code: string, actor?: string) => runAdminAction('MARK_SEATED', { code, actor }),
    [runAdminAction]
  );

  const markAsCompleted = useCallback(
    (code: string, actor?: string) => runAdminAction('MARK_COMPLETED', { code, actor }),
    [runAdminAction]
  );

  const markAsNoShow = useCallback(
    (code: string, actor?: string, reason?: string) =>
      runAdminAction('MARK_NO_SHOW', { code, actor, reason }),
    [runAdminAction]
  );

  // Leases now live server-side in Redis; refreshing DB state is the safe no-op.
  const autoReleaseExpiredLocks = useCallback(() => { void fetchData(); }, [fetchData]);
  const resetToDefaults = useCallback(() => { void fetchData(); }, [fetchData]);

  // ---------- Storefront operations ----------

  const createReservation = useCallback(
    async (data: {
      customerName: string;
      customerPhone?: string;
      date: string;
      time: string;
      guestCount: number;
      notes?: string;
      preferredArea?: TableArea;
      paymentAmount?: number;
      payDepositNow?: boolean;
    }): Promise<{ success: boolean; message: string; reservation?: Reservation }> => {
      try {
        const res = await createReservationRemote({
          tenantId: activeTenantId,
          customerName: data.customerName,
          customerPhone: data.customerPhone || '-',
          date: data.date,
          time: data.time,
          guestCount: data.guestCount,
          preferredArea: data.preferredArea,
          notes: data.notes,
          payDepositNow: data.payDepositNow,
          paymentAmount: data.paymentAmount,
        });
        return { success: true, message: res.message, reservation: res.reservation };
      } catch (err: any) {
        return { success: false, message: err?.message || 'Reservasi gagal disimpan ke server.' };
      }
    },
    [activeTenantId]
  );

  const checkAvailability = useCallback(
    async (date: string, time: string, guestCount: number, preferredArea?: TableArea) => {
      try {
        return await checkAvailabilityRemote({
          tenantId: activeTenantId,
          date,
          time,
          guestCount,
          preferredArea,
        });
      } catch (err: any) {
        return { available: false, availableTables: [], reason: err?.message || 'Gagal mengecek ketersediaan.' };
      }
    },
    [activeTenantId]
  );

  const getMenuItems = useCallback(
    (category?: MenuCategory | 'Semua', search?: string) =>
      menu.filter((item) => {
        if (category && category !== 'Semua' && item.category !== category) return false;
        if (search && search.trim()) {
          const q = search.toLowerCase();
          return (
            item.name.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [menu]
  );

  const getReservationByCode = useCallback(
    (code: string) => reservations.find((r) => r.code.toUpperCase() === code.trim().toUpperCase()),
    [reservations]
  );

  return useMemo(
    () => ({
      mode,
      isClient,
      isDbConnected,
      authError,
      tenantId: activeTenantId,
      setTenantId,
      availableTenants: AVAILABLE_TENANTS,
      refresh: () => fetchData(activeTenantId),
      profile,
      tables,
      menu,
      reservations,
      auditEvents,
      // operations
      getMenuItems,
      toggleMenuAvailability,
      checkAvailability,
      createReservation,
      getReservationByCode,
      updateTableStatus,
      updateReservationStatus,
      createWalkInSeated,
      createManualOfflineBooking,
      addOrderItemsToReservation,
      settleOfflinePayment,
      markAsSeated,
      markAsCompleted,
      markAsNoShow,
      autoReleaseExpiredLocks,
      resetToDefaults,
    }),
    [
      mode, isClient, isDbConnected, authError, activeTenantId, setTenantId, fetchData,
      profile, tables, menu, reservations, auditEvents, getMenuItems, toggleMenuAvailability,
      checkAvailability, createReservation, getReservationByCode, updateTableStatus,
      updateReservationStatus, createWalkInSeated, createManualOfflineBooking,
      addOrderItemsToReservation, settleOfflinePayment, markAsSeated, markAsCompleted,
      markAsNoShow, autoReleaseExpiredLocks, resetToDefaults,
    ]
  );
}
