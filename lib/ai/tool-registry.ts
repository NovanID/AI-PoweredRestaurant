import { ToolDefinition } from './types';

/**
 * Declarative Tool Registry (Schema Discovery & Validation only)
 * Follows Single Responsibility: DOES NOT execute DB mutations directly.
 */
export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  get_restaurant_info: {
    name: 'get_restaurant_info',
    description: 'Mendapatkan informasi profil restoran, jam operasional, alamat, dan kontak.',
    parameters: {
      type: 'object',
      properties: {},
    },
    requiresConfirmation: false,
    isMutating: false,
    tenantScoped: true,
    timeoutMs: 1500,
  },

  get_menu: {
    name: 'get_menu',
    description: 'Mencari menu hidangan dan minuman berdasarkan kategori, harga maksimal, atau level kepedasan.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Kategori menu (contoh: Lauk Utama, Minuman, Semua)' },
        search: { type: 'string', description: 'Kata kunci pencarian nama atau deskripsi menu' },
        maxPrice: { type: 'number', description: 'Batas harga maksimal dalam Rupiah' },
        spicinessLevel: { type: 'number', description: 'Level pedas (1, 2, atau 3)' },
      },
    },
    requiresConfirmation: false,
    isMutating: false,
    tenantScoped: true,
    timeoutMs: 2000,
  },

  check_availability: {
    name: 'check_availability',
    description: 'Mengecek ketersediaan meja restoran secara realtime pada tanggal, jam, dan jumlah tamu tertentu.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Format tanggal YYYY-MM-DD' },
        time: { type: 'string', description: 'Format jam HH:mm (contoh: 19:00)' },
        guestCount: { type: 'number', description: 'Jumlah tamu/orang' },
        preferredArea: { type: 'string', description: 'Area meja pilihan: Indoor, Outdoor, VIP' },
      },
      required: ['date', 'time', 'guestCount'],
    },
    requiresConfirmation: false,
    isMutating: false,
    tenantScoped: true,
    timeoutMs: 2500,
  },

  request_reservation_hold: {
    name: 'request_reservation_hold',
    description: 'Mengunci slot meja sementara (Lease Hold 10 menit) sebelum konfirmasi final dari pelanggan.',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string', description: 'Nama pemesan' },
        customerPhone: { type: 'string', description: 'Nomor telepon/WhatsApp pemesan' },
        date: { type: 'string', description: 'Format tanggal YYYY-MM-DD' },
        time: { type: 'string', description: 'Format jam HH:mm (contoh: 19:00)' },
        guestCount: { type: 'number', description: 'Jumlah orang' },
        preferredArea: { type: 'string', description: 'Area meja pilihan (Indoor/Outdoor/VIP)' },
        notes: { type: 'string', description: 'Catatan khusus pesanan' },
      },
      required: ['customerName', 'date', 'time', 'guestCount'],
    },
    requiresConfirmation: true,
    isMutating: true,
    tenantScoped: true,
    timeoutMs: 3000,
  },

  confirm_reservation: {
    name: 'confirm_reservation',
    description: 'Melakukan atomic commit reservasi yang telah di-hold setelah pelanggan setuju.',
    parameters: {
      type: 'object',
      properties: {
        leaseToken: { type: 'string', description: 'Token lease kunci meja sementara' },
        idempotencyKey: { type: 'string', description: 'Kunci unik pencegah duplikasi transaksi' },
      },
      required: ['leaseToken', 'idempotencyKey'],
    },
    requiresConfirmation: false,
    isMutating: true,
    tenantScoped: true,
    timeoutMs: 3000,
  },

  get_reservation: {
    name: 'get_reservation',
    description: 'Mencari tiket status reservasi berdasarkan kode unik (contoh: RM-1024).',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Kode reservasi unik pelanggan' },
      },
      required: ['code'],
    },
    requiresConfirmation: false,
    isMutating: false,
    tenantScoped: true,
    timeoutMs: 2000,
  },

  cancel_reservation: {
    name: 'cancel_reservation',
    description: 'Membatalkan reservasi yang sudah terdaftar.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Kode reservasi yang akan dibatalkan' },
        reason: { type: 'string', description: 'Alasan pembatalan' },
      },
      required: ['code'],
    },
    requiresConfirmation: true,
    isMutating: true,
    tenantScoped: true,
    timeoutMs: 2500,
  },

  update_reservation: {
    name: 'update_reservation',
    description: 'Mengubah jadwal (tanggal/jam) atau jumlah tamu pada reservasi yang ada.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Kode reservasi yang ingin diubah' },
        newDate: { type: 'string', description: 'Format tanggal baru YYYY-MM-DD' },
        newTime: { type: 'string', description: 'Format jam baru HH:mm' },
        newGuestCount: { type: 'number', description: 'Jumlah tamu baru' },
      },
      required: ['code'],
    },
    requiresConfirmation: true,
    isMutating: true,
    tenantScoped: true,
    timeoutMs: 3000,
  },

  calculate_order_total: {
    name: 'calculate_order_total',
    description: 'Menghitung estimasi total harga pesanan makanan beserta pajak dan diskon.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Daftar item pesanan berisi menuItemId dan quantity',
        },
      },
      required: ['items'],
    },
    requiresConfirmation: false,
    isMutating: false,
    tenantScoped: true,
    timeoutMs: 1500,
  },

  contact_human: {
    name: 'contact_human',
    description: 'Mengarahkan percakapan ke operator staf restoran manusia (Human Handoff).',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Alasan eskalasi ke staf' },
      },
      required: ['reason'],
    },
    requiresConfirmation: false,
    isMutating: true,
    tenantScoped: true,
    timeoutMs: 2000,
  },
};

export class ToolRegistry {
  public static getDefinition(toolName: string): ToolDefinition | undefined {
    return TOOL_REGISTRY[toolName];
  }

  public static listAvailableTools(): ToolDefinition[] {
    return Object.values(TOOL_REGISTRY);
  }

  /**
   * Validate parameter completeness against tool schema
   */
  public static validateParams(toolName: string, params: Record<string, any>): { valid: boolean; missing: string[] } {
    const def = this.getDefinition(toolName);
    if (!def) return { valid: false, missing: ['tool_not_found'] };

    const required = def.parameters.required || [];
    const missing = required.filter((param) => params[param] === undefined || params[param] === null || params[param] === '');

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}
