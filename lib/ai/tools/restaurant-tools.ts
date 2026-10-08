import { restaurantStore } from '../../restaurant-store.ts';
import type { AIToolDefinition, ToolResult } from '../types.ts';
import type { MenuCategory, TableArea } from '../../../types/restaurant.ts';

function objectInput(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function success(message: string, data?: unknown, userSafeMessage?: string): ToolResult {
  return { success: true, data, message, userSafeMessage };
}

export const restaurantTools: AIToolDefinition[] = [
  {
    name: 'get_restaurant_info',
    description: 'Ambil profil, alamat, kontak, jam operasional, dan kebijakan restoran.',
    inputSchema: {},
    async execute() {
      const profile = restaurantStore.getProfile();
      return success(
        `Informasi Restoran ${profile.name}: ${profile.tagline}. Alamat: ${profile.address}, ${profile.city}. Jam Buka: ${profile.openingHours}. Kontak: ${profile.phone}.`,
        profile
      );
    },
  },
  {
    name: 'get_menu',
    description: 'Ambil menu berdasarkan kategori atau pencarian.',
    inputSchema: {},
    async execute(input) {
      const params = objectInput(input);
      const category = asString(params.category) as MenuCategory | 'Semua' | undefined;
      const search = asString(params.search);
      const items = restaurantStore.getMenuItems(category, search);
      return success(`Ditemukan ${items.length} menu yang cocok.`, items);
    },
  },
  {
    name: 'search_menu',
    description: 'Cari menu berdasarkan kata kunci.',
    inputSchema: {},
    async execute(input) {
      const params = objectInput(input);
      const search = asString(params.search) || '';
      const items = restaurantStore.getMenuItems('Semua', search);
      return success(`Ditemukan ${items.length} menu yang cocok untuk "${search}".`, items);
    },
  },
  {
    name: 'check_availability',
    description: 'Cek ketersediaan meja.',
    inputSchema: {},
    async execute(input) {
      const params = objectInput(input);
      const date = asString(params.date) || '';
      const time = asString(params.time) || '';
      const guestCount = asNumber(params.guestCount) || 0;
      const preferredArea = asString(params.preferredArea) as TableArea | undefined;
      const result = restaurantStore.checkAvailability(date, time, guestCount, preferredArea);
      return {
        success: result.available,
        data: result,
        message: result.available
          ? `Tersedia ${result.availableTables.length} meja untuk ${guestCount} tamu pada ${date} pukul ${time}.`
          : result.reason || 'Meja tidak tersedia.',
      };
    },
  },
  {
    name: 'create_reservation',
    description: 'Buat reservasi baru.',
    inputSchema: {},
    async execute(input) {
      const params = objectInput(input);
      const result = restaurantStore.createReservation({
        customerName: asString(params.customerName) || '',
        customerPhone: asString(params.customerPhone) || '',
        date: asString(params.date) || '',
        time: asString(params.time) || '',
        guestCount: asNumber(params.guestCount) || 0,
        notes: asString(params.notes),
        preferredArea: asString(params.preferredArea) as TableArea | undefined,
        actor: 'AI Assistant',
      });
      return {
        success: result.success,
        data: result.reservation,
        message: result.message,
      };
    },
  },
  {
    name: 'get_reservation',
    description: 'Ambil reservasi berdasarkan kode.',
    inputSchema: {},
    async execute(input) {
      const params = objectInput(input);
      const code = asString(params.code) || '';
      const reservation = restaurantStore.getReservationByCode(code);
      if (!reservation) {
        return { success: false, message: `Reservasi dengan kode "${code}" tidak ditemukan.`, errorCode: 'RESERVATION_NOT_FOUND' };
      }
      return success(`Reservasi ${reservation.code} ditemukan. Status: ${reservation.status}.`, reservation);
    },
  },
  {
    name: 'update_reservation',
    description: 'Ubah reservasi.',
    inputSchema: {},
    async execute(input) {
      const params = objectInput(input);
      const result = restaurantStore.updateReservation(
        asString(params.code) || '',
        {
          date: asString(params.newDate),
          time: asString(params.newTime),
          guestCount: params.newGuestCount === undefined ? undefined : asNumber(params.newGuestCount),
          preferredArea: asString(params.preferredArea) as TableArea | undefined,
          notes: asString(params.notes),
        },
        'AI Assistant'
      );
      return { success: result.success, data: result.reservation, message: result.message };
    },
  },
  {
    name: 'cancel_reservation',
    description: 'Batalkan reservasi.',
    inputSchema: {},
    async execute(input) {
      const params = objectInput(input);
      const result = restaurantStore.updateReservationStatus(
        asString(params.code) || '',
        'cancelled',
        'AI Assistant',
        asString(params.reason) || 'Dibatalkan oleh customer melalui AI Assistant'
      );
      return { success: result.success, data: result.reservation, message: result.message };
    },
  },
];
