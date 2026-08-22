import { restaurantStore } from './restaurant-store';
import { MenuCategory, TableArea, ReservationStatus } from '../types/restaurant';

export interface ToolResult {
  tool: string;
  success: boolean;
  data: any;
  message: string;
}

export const restaurantAITools = {
  get_restaurant_info: (): ToolResult => {
    const profile = restaurantStore.getProfile();
    return {
      tool: 'get_restaurant_info',
      success: true,
      data: profile,
      message: `Informasi Restoran ${profile.name}: ${profile.tagline}. Alamat: ${profile.address}, ${profile.city}. Jam Buka: ${profile.openingHours}. Kontak: ${profile.phone}.`,
    };
  },

  get_menu: (category?: string, search?: string): ToolResult => {
    const menuItems = restaurantStore.getMenuItems(category as MenuCategory | 'Semua', search);
    return {
      tool: 'get_menu',
      success: true,
      data: menuItems,
      message: `Ditemukan ${menuItems.length} menu yang cocok.`,
    };
  },

  check_availability: (params: {
    date: string;
    time: string;
    guestCount: number;
    preferredArea?: string;
  }): ToolResult => {
    const result = restaurantStore.checkAvailability(
      params.date,
      params.time,
      Number(params.guestCount),
      params.preferredArea as TableArea | undefined
    );
    return {
      tool: 'check_availability',
      success: result.available,
      data: result,
      message: result.available
        ? `Tersedia ${result.availableTables.length} meja yang cocok untuk ${params.guestCount} orang pada ${params.date} pukul ${params.time} WIB.`
        : (result.reason || 'Meja tidak tersedia.'),
    };
  },

  create_reservation: (params: {
    customerName: string;
    customerPhone: string;
    date: string;
    time: string;
    guestCount: number;
    notes?: string;
    preferredArea?: string;
  }): ToolResult => {
    const result = restaurantStore.createReservation({
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      date: params.date,
      time: params.time,
      guestCount: Number(params.guestCount),
      notes: params.notes,
      preferredArea: params.preferredArea as TableArea | undefined,
      actor: 'AI Assistant',
    });
    return {
      tool: 'create_reservation',
      success: result.success,
      data: result.reservation,
      message: result.message,
    };
  },

  get_reservation: (code: string): ToolResult => {
    const reservation = restaurantStore.getReservationByCode(code);
    if (!reservation) {
      return {
        tool: 'get_reservation',
        success: false,
        data: null,
        message: `Reservasi dengan kode "${code}" tidak ditemukan. Pastikan format kode benar (contoh: RM-1001).`,
      };
    }
    return {
      tool: 'get_reservation',
      success: true,
      data: reservation,
      message: `Data reservasi ${reservation.code} ditemukan. Status: ${reservation.status}. Atas nama ${reservation.customerName} untuk ${reservation.guestCount} orang pada ${reservation.date} pukul ${reservation.time}.`,
    };
  },

  update_reservation: (params: {
    code: string;
    newDate?: string;
    newTime?: string;
    newGuestCount?: number;
    preferredArea?: string;
    notes?: string;
  }): ToolResult => {
    const result = restaurantStore.updateReservation(
      params.code,
      {
        date: params.newDate,
        time: params.newTime,
        guestCount: params.newGuestCount !== undefined ? Number(params.newGuestCount) : undefined,
        preferredArea: params.preferredArea as TableArea | undefined,
        notes: params.notes,
      },
      'AI Assistant (Permintaan Reschedule Customer)'
    );
    return {
      tool: 'update_reservation',
      success: result.success,
      data: result.reservation,
      message: result.message,
    };
  },

  cancel_reservation: (code: string, reason?: string): ToolResult => {
    const result = restaurantStore.updateReservationStatus(
      code,
      'cancelled',
      'AI Assistant (Permintaan Customer)',
      reason || 'Dibatalkan oleh customer melalui AI Assistant'
    );
    return {
      tool: 'cancel_reservation',
      success: result.success,
      data: result.reservation,
      message: result.message,
    };
  },
};
