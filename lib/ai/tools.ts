import { tool } from 'ai';
import {
  GetRestaurantInfoSchema,
  GetMenuSchema,
  CheckAvailabilitySchema,
  RequestReservationHoldSchema,
  ConfirmReservationSchema,
  GetReservationSchema,
  CancelReservationSchema,
  UpdateReservationSchema,
  CalculateOrderTotalSchema,
  CreateTakeawayOrderSchema,
  ContactHumanSchema,
} from './tool-schemas';
import { ToolExecutor } from '../domain/tool-executor';
import { TenantId } from '../domain/types';
import { ToolResult } from './types';

export interface ToolExecutionContext {
  tenantId: TenantId;
  conversationId: string;
  traceId?: string;
  onToolExecuted?: (result: ToolResult) => void;
}

/**
 * Standardized Tool Calling Definition using Vercel AI SDK (ai)
 * Binds Zod schemas to ToolExecutor domain logic.
 */
export function createRestaurantTools(context: ToolExecutionContext) {
  return {
    get_restaurant_info: tool({
      description: 'Mendapatkan informasi profil restoran, jam operasional, alamat, dan kontak.',
      inputSchema: GetRestaurantInfoSchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'get_restaurant_info',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),

    get_menu: tool({
      description: 'Mencari menu hidangan dan minuman berdasarkan kategori, harga maksimal, atau level kepedasan.',
      inputSchema: GetMenuSchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'get_menu',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),

    check_availability: tool({
      description: 'Mengecek ketersediaan meja restoran secara realtime pada tanggal, jam, dan jumlah tamu tertentu.',
      inputSchema: CheckAvailabilitySchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'check_availability',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),

    request_reservation_hold: tool({
      description: 'Mengunci slot meja sementara (Lease Hold 10 menit) sebelum konfirmasi final dari pelanggan.',
      inputSchema: RequestReservationHoldSchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'request_reservation_hold',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),

    confirm_reservation: tool({
      description: 'Melakukan atomic commit reservasi yang telah di-hold setelah pelanggan setuju.',
      inputSchema: ConfirmReservationSchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'confirm_reservation',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),

    get_reservation: tool({
      description: 'Mencari tiket status reservasi berdasarkan kode unik (contoh: RM-1024).',
      inputSchema: GetReservationSchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'get_reservation',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),

    cancel_reservation: tool({
      description: 'Membatalkan reservasi yang sudah terdaftar.',
      inputSchema: CancelReservationSchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'cancel_reservation',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),

    update_reservation: tool({
      description: 'Mengubah jadwal (tanggal/jam) atau jumlah tamu pada reservasi yang ada.',
      inputSchema: UpdateReservationSchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'update_reservation',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),

    calculate_order_total: tool({
      description: 'Menghitung estimasi total harga pesanan makanan beserta pajak jika pelanggan SUDAH menyebutkan nama menu spesifik dan jumlahnya.',
      inputSchema: CalculateOrderTotalSchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'calculate_order_total',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),

    create_takeaway_order: tool({
      description: 'Membuat pesanan bungkus (takeaway) resmi ke sistem dan mengunci rincian pesanan untuk lanjut ke pembayaran kasir / Midtrans.',
      inputSchema: CreateTakeawayOrderSchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'create_takeaway_order',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),

    contact_human: tool({
      description: 'Mengarahkan percakapan ke operator staf restoran manusia (Human Handoff).',
      inputSchema: ContactHumanSchema,
      execute: async (args) => {
        const result = await ToolExecutor.execute({
          toolName: 'contact_human',
          rawArgs: args,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        });
        context.onToolExecuted?.(result);
        return result;
      },
    }),
  };
}
