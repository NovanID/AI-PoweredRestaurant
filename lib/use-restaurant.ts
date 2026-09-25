"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { restaurantStore } from './restaurant-store';
import {
  RestaurantProfile,
  Table,
  MenuItem,
  Reservation,
  AuditEvent,
  ReservationStatus,
  MenuCategory,
  TableArea,
} from '../types/restaurant';
import {
  DEFAULT_TENANT_ID,
  AVAILABLE_TENANTS,
  getTenantInitialData,
} from './mock-data';

// Helper for sending admin mutations to PostgreSQL
async function sendAdminAction(action: string, payload: Record<string, any>) {
  const res = await fetch('/api/admin/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await res.json();
  if (!res.ok || !result.success) throw new Error(result.message || `Aksi ${action} gagal.`);
  return result;
}

export function useRestaurant(initialTenantId?: string) {
  const [activeTenantId, setActiveTenantId] = useState<string>(initialTenantId || DEFAULT_TENANT_ID);
  const initialBundle = getTenantInitialData(activeTenantId);

  const [profile, setProfile] = useState<RestaurantProfile>(initialBundle.profile);
  const [tables, setTables] = useState<Table[]>(initialBundle.tables);
  const [menu, setMenu] = useState<MenuItem[]>(initialBundle.menu);
  const [reservations, setReservations] = useState<Reservation[]>(initialBundle.reservations);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(initialBundle.auditEvents);
  const [isClient, setIsClient] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const isFetchingRef = useRef(false);

  // Sync state from PostgreSQL API for active tenant
  const fetchDbState = useCallback(async (targetTenantId?: string) => {
    const currentTenant = targetTenantId || activeTenantId;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await fetch(`/api/admin/data?tenantId=${encodeURIComponent(currentTenant)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();

      if (json.success && json.data) {
        setIsDbConnected(json.source === 'postgresql');
        const {
          profile: dbProfile,
          tables: dbTables,
          menu: dbMenu,
          reservations: dbReservations,
          auditEvents: dbAuditEvents,
        } = json.data;

        if (dbProfile) setProfile(dbProfile);
        if (Array.isArray(dbTables)) setTables(dbTables);
        if (Array.isArray(dbMenu)) setMenu(dbMenu);
        if (Array.isArray(dbReservations)) setReservations(dbReservations);
        if (Array.isArray(dbAuditEvents)) setAuditEvents(dbAuditEvents);

        // Also hydrate client store to keep local fallback synchronized
        restaurantStore.hydrateFromDb(json.data);
      }
    } catch (err) {
      console.warn('[useRestaurant] DB sync poll error, relying on local fallback:', err);
      setIsDbConnected(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [activeTenantId]);

  const dispatchAdminAction = useCallback((action: string, payload: Record<string, any>) => {
    void sendAdminAction(action, payload)
      .then(() => fetchDbState())
      .catch((error) => {
        setIsDbConnected(false);
        console.error(`[useRestaurant] ${action} gagal disimpan ke PostgreSQL:`, error);
      });
  }, [fetchDbState]);

  // Tenant switch function
  const setTenantId = useCallback((newTenantId: string) => {
    setActiveTenantId(newTenantId);
    restaurantStore.switchTenant(newTenantId);
    fetchDbState(newTenantId);
  }, [fetchDbState]);

  useEffect(() => {
    setIsClient(true);
    restaurantStore.initFromStorage();
    const syncState = () => {
      setProfile(restaurantStore.getProfile());
      setTables(restaurantStore.getTables());
      setMenu(restaurantStore.getMenuItems());
      setReservations(restaurantStore.getAllReservations());
      setAuditEvents(restaurantStore.getAuditEvents());
    };

    syncState();
    const unsubscribe = restaurantStore.subscribe(syncState);

    // Initial fetch from PostgreSQL
    fetchDbState(activeTenantId);

    // 5-second polling interval for real-time cashier sync
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDbState(activeTenantId);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [activeTenantId, fetchDbState]);

  const getMenuItems = useCallback(
    (category?: MenuCategory | 'Semua', search?: string) =>
      restaurantStore.getMenuItems(category, search),
    []
  );

  const toggleMenuAvailability = useCallback(
    (id: string, actor?: string) => {
      const opt = restaurantStore.toggleMenuItemAvailability(id, actor);
      dispatchAdminAction('TOGGLE_MENU', { id, actor, tenantId: activeTenantId });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
  );

  const checkAvailability = useCallback(
    (date: string, time: string, guestCount: number, preferredArea?: TableArea) =>
      restaurantStore.checkAvailability(date, time, guestCount, preferredArea),
    []
  );

  const createReservation = useCallback(
    (data: {
      customerName: string;
      customerPhone?: string;
      date: string;
      time: string;
      guestCount: number;
      notes?: string;
      preferredArea?: TableArea;
      paymentAmount?: number;
      paymentStatus?: any;
      snapToken?: string;
      actor?: string;
    }) => {
      const opt = restaurantStore.createReservation(data);
      if (!opt.success || !opt.reservation) return Promise.resolve(opt);

      return sendAdminAction('CREATE_RESERVATION', {
          tenantId: activeTenantId,
          reservation: opt.reservation,
          actor: data.actor || 'Web Customer',
        })
        .then(async (result) => {
          await fetchDbState();
          return { success: true, message: result.message, reservation: result.reservation };
        })
        .catch((error) => {
          setIsDbConnected(false);
          return {
            success: false,
            message: error.message || 'Reservasi gagal disimpan ke PostgreSQL.',
            reservation: undefined,
          };
        });
    },
    [activeTenantId, fetchDbState]
  );

  const getReservationByCode = useCallback(
    (code: string) => {
      const found = reservations.find((r) => r.code.toUpperCase() === code.trim().toUpperCase());
      return found || restaurantStore.getReservationByCode(code);
    },
    [reservations]
  );

  // Direct remote lookup for customer tracking modal from PostgreSQL
  const fetchReservationByCode = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/reservations/lookup?code=${encodeURIComponent(code.trim())}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data : null;
    } catch {
      return null;
    }
  }, []);

  const updateReservation = useCallback(
    (
      code: string,
      newData: {
        date?: string;
        time?: string;
        guestCount?: number;
        notes?: string;
        preferredArea?: TableArea;
      },
      actor?: string
    ) => {
      const opt = restaurantStore.updateReservation(code, newData, actor);
      dispatchAdminAction('UPDATE_RESERVATION', {
        tenantId: activeTenantId,
        code,
        ...newData,
        actor,
      });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
  );

  const updateTableStatus = useCallback(
    (id: string, status: any, actor?: string) => {
      const opt = restaurantStore.updateTableStatus(id, status, actor);
      dispatchAdminAction('UPDATE_TABLE_STATUS', { tableId: id, status, actor, tenantId: activeTenantId });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
  );

  const updateReservationStatus = useCallback(
    (
      code: string,
      status: ReservationStatus,
      actor?: string,
      reason?: string
    ) => {
      const opt = restaurantStore.updateReservationStatus(code, status, actor, reason);
      dispatchAdminAction('UPDATE_RESERVATION_STATUS', { code, status, actor, reason, tenantId: activeTenantId });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
  );

  const createWalkInSeated = useCallback(
    (tableId: string, guestCount?: number, actor?: string) => {
      const opt = restaurantStore.createWalkInSeated(tableId, guestCount, actor);
      dispatchAdminAction('WALK_IN_SEATED', {
        tableId,
        guestCount,
        actor,
        tenantId: activeTenantId,
        code: opt.reservation?.code,
      });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
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
    }) => {
      const opt = restaurantStore.createManualOfflineBooking(data);
      dispatchAdminAction('MANUAL_BOOKING', {
        ...data,
        tenantId: activeTenantId,
        code: opt.reservation?.code,
      });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
  );

  const addOrderItemsToReservation = useCallback(
    (code: string, items: any[], actor?: string) => {
      const opt = restaurantStore.addOrderItemsToReservation(code, items, actor);
      dispatchAdminAction('ADD_ORDER_ITEMS', { code, items, actor, tenantId: activeTenantId });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
  );

  const settleOfflinePayment = useCallback(
    (code: string, paymentMethod?: string, actor?: string) => {
      const opt = restaurantStore.settleOfflinePayment(code, paymentMethod, actor);
      dispatchAdminAction('SETTLE_PAYMENT', { code, paymentMethod, actor, tenantId: activeTenantId });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
  );

  const markAsSeated = useCallback(
    (code: string, actor?: string) => {
      const opt = restaurantStore.markAsSeated(code, actor);
      dispatchAdminAction('MARK_SEATED', { code, actor, tenantId: activeTenantId });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
  );

  const markAsCompleted = useCallback(
    (code: string, actor?: string) => {
      const opt = restaurantStore.markAsCompleted(code, actor);
      dispatchAdminAction('MARK_COMPLETED', { code, actor, tenantId: activeTenantId });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
  );

  const markAsNoShow = useCallback(
    (code: string, actor?: string, reason?: string) => {
      const opt = restaurantStore.markAsNoShow(code, actor, reason);
      dispatchAdminAction('MARK_NO_SHOW', { code, actor, reason, tenantId: activeTenantId });
      return opt;
    },
    [activeTenantId, dispatchAdminAction]
  );

  const autoReleaseExpiredLocks = useCallback(
    () => restaurantStore.autoReleaseExpiredLocks(),
    []
  );

  const resetToDefaults = useCallback(() => restaurantStore.resetToDefaults(), []);

  return {
    isClient,
    isDbConnected,
    tenantId: activeTenantId,
    setTenantId,
    availableTenants: AVAILABLE_TENANTS,
    refresh: () => fetchDbState(activeTenantId),
    profile,
    tables,
    menu,
    reservations,
    auditEvents,
    // Operations (memoized)
    getMenuItems,
    toggleMenuAvailability,
    checkAvailability,
    createReservation,
    getReservationByCode,
    fetchReservationByCode,
    updateReservation,
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
  };
}
