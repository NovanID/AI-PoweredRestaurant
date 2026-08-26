"use client";

import { useState, useEffect, useCallback } from 'react';
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
  initialRestaurantProfile,
  initialTables,
  initialMenuItems,
  initialReservations,
  initialAuditEvents,
} from './mock-data';

export function useRestaurant() {
  const [profile, setProfile] = useState<RestaurantProfile>(initialRestaurantProfile);
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [menu, setMenu] = useState<MenuItem[]>(initialMenuItems);
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(initialAuditEvents);
  const [isClient, setIsClient] = useState(false);

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
    return () => unsubscribe();
  }, []);

  const getMenuItems = useCallback(
    (category?: MenuCategory | 'Semua', search?: string) =>
      restaurantStore.getMenuItems(category, search),
    []
  );

  const toggleMenuAvailability = useCallback(
    (id: string, actor?: string) =>
      restaurantStore.toggleMenuItemAvailability(id, actor),
    []
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
    }) => restaurantStore.createReservation(data),
    []
  );

  const getReservationByCode = useCallback(
    (code: string) => restaurantStore.getReservationByCode(code),
    []
  );

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
    ) => restaurantStore.updateReservation(code, newData, actor),
    []
  );

  const updateTableStatus = useCallback(
    (id: string, status: any, actor?: string) =>
      restaurantStore.updateTableStatus(id, status, actor),
    []
  );

  const updateReservationStatus = useCallback(
    (
      code: string,
      status: ReservationStatus,
      actor?: string,
      reason?: string
    ) => restaurantStore.updateReservationStatus(code, status, actor, reason),
    []
  );

  const updatePaymentStatus = useCallback(
    (
      code: string,
      paymentStatus: any,
      paymentMethod?: string,
      amount?: number,
      actor?: string
    ) => restaurantStore.updatePaymentStatus(code, paymentStatus, paymentMethod, amount, actor),
    []
  );

  const setReservationSnapToken = useCallback(
    (code: string, snapToken: string) =>
      restaurantStore.setReservationSnapToken(code, snapToken),
    []
  );

  const createWalkInSeated = useCallback(
    (tableId: string, guestCount?: number, actor?: string) =>
      restaurantStore.createWalkInSeated(tableId, guestCount, actor),
    []
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
    }) => restaurantStore.createManualOfflineBooking(data),
    []
  );

  const addOrderItemsToReservation = useCallback(
    (code: string, items: any[], actor?: string) =>
      restaurantStore.addOrderItemsToReservation(code, items, actor),
    []
  );

  const settleOfflinePayment = useCallback(
    (code: string, paymentMethod?: string, actor?: string) =>
      restaurantStore.settleOfflinePayment(code, paymentMethod, actor),
    []
  );

  const markAsSeated = useCallback(
    (code: string, actor?: string) =>
      restaurantStore.markAsSeated(code, actor),
    []
  );

  const markAsCompleted = useCallback(
    (code: string, actor?: string) =>
      restaurantStore.markAsCompleted(code, actor),
    []
  );

  const markAsNoShow = useCallback(
    (code: string, actor?: string, reason?: string) =>
      restaurantStore.markAsNoShow(code, actor, reason),
    []
  );

  const autoReleaseExpiredLocks = useCallback(
    () => restaurantStore.autoReleaseExpiredLocks(),
    []
  );

  const resetToDefaults = useCallback(() => restaurantStore.resetToDefaults(), []);

  return {
    isClient,
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
    updateReservation,
    updateTableStatus,
    updateReservationStatus,
    updatePaymentStatus,
    setReservationSnapToken,
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
