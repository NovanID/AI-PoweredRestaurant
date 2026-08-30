import { TenantId } from './types';
import { ToolResult } from '../ai/types';
import { ToolRegistry } from '../ai/tool-registry';
import { ReservationService } from './reservation-service';
import { restaurantStore } from '../restaurant-store';
import { IdempotencyManager } from '../infrastructure/idempotency';
import { DomainEventBus } from '../infrastructure/event-bus';
import { ObservabilityManager } from '../infrastructure/observability';

export class ToolExecutor {
  /**
   * Safe execution pipeline:
   * 1. Schema Validation -> 2. Tenant Auth -> 3. Idempotency Check -> 4. Domain Service -> 5. Event Emit
   */
  public static async execute(params: {
    toolName: string;
    rawArgs: Record<string, any>;
    tenantId: TenantId;
    conversationId: string;
    traceId?: string;
  }): Promise<ToolResult> {
    const { toolName, rawArgs, tenantId, conversationId, traceId } = params;
    const endSpan = traceId ? ObservabilityManager.startSpan(traceId, `tool:${toolName}`) : () => {};

    try {
      // 1. Schema parameter validation
      const paramCheck = ToolRegistry.validateParams(toolName, rawArgs);
      if (!paramCheck.valid) {
        return {
          tool: toolName,
          success: false,
          data: null,
          message: `Parameter tool tidak lengkap. Kurang: ${paramCheck.missing.join(', ')}`,
          errorCode: 'MISSING_PARAMETERS',
        };
      }

      // 2. Dispatch to specific domain service
      switch (toolName) {
        case 'get_restaurant_info': {
          const profile = restaurantStore.getProfile();
          return {
            tool: toolName,
            success: true,
            data: profile,
            message: `Informasi ${profile.name}: ${profile.tagline}. Alamat: ${profile.address}, ${profile.city}. Jam Buka: ${profile.openTime} - ${profile.closeTime} WIB. Kontak: ${profile.phone}.`,
          };
        }

        case 'get_menu': {
          const { category, search, maxPrice, spicinessLevel } = rawArgs;
          let items = restaurantStore.getMenuItems(category || 'Semua', search);

          // If no exact match and search has multiple words, try first word fallback
          if (items.length === 0 && search && typeof search === 'string') {
            const words = search.split(/\s+/).filter((w) => w.length > 2);
            for (const word of words) {
              const fallbackItems = restaurantStore.getMenuItems(category || 'Semua', word);
              if (fallbackItems.length > 0) {
                items = fallbackItems;
                break;
              }
            }
          }

          if (maxPrice) {
            items = items.filter((m) => m.price <= Number(maxPrice));
          }
          if (spicinessLevel) {
            items = items.filter((m) => m.spicinessLevel === Number(spicinessLevel));
          }

          return {
            tool: toolName,
            success: true,
            data: items,
            message: items.length > 0 ? `Ditemukan ${items.length} menu yang cocok.` : `Menu "${search}" tidak ditemukan.`,
          };
        }

        case 'check_availability': {
          const result = ReservationService.checkAvailability({
            tenantId,
            date: rawArgs.date,
            time: rawArgs.time,
            guestCount: Number(rawArgs.guestCount),
            preferredArea: rawArgs.preferredArea,
          });

          return {
            tool: toolName,
            success: result.available,
            data: result,
            message: result.available
              ? `Tersedia ${result.availableTables.length} meja yang cocok untuk ${rawArgs.guestCount} orang pada ${rawArgs.date} pukul ${rawArgs.time} WIB.`
              : (result.reason || 'Meja tidak tersedia.'),
          };
        }

        case 'request_reservation_hold': {
          const holdResult = ReservationService.createHoldLease({
            tenantId,
            conversationId,
            customerName: rawArgs.customerName,
            customerPhone: rawArgs.customerPhone || '-',
            date: rawArgs.date,
            time: rawArgs.time,
            guestCount: Number(rawArgs.guestCount),
            preferredArea: rawArgs.preferredArea,
            notes: rawArgs.notes,
          });

          return {
            tool: toolName,
            success: holdResult.success,
            data: holdResult.lease || null,
            message: holdResult.message,
          };
        }

        case 'confirm_reservation': {
          const idempotencyKey = rawArgs.idempotencyKey || `idem_res_${rawArgs.leaseToken}`;
          const idCheck = IdempotencyManager.acquire(idempotencyKey);

          if (!idCheck.acquired && idCheck.existingRecord?.status === 'COMMITTED') {
            return {
              tool: toolName,
              success: true,
              data: idCheck.existingRecord.responsePayload,
              message: 'Reservasi ini telah berhasil dikonfirmasi sebelumnya (idempotent result).',
            };
          }

          const commitResult = ReservationService.commitLeasedReservation({
            leaseToken: rawArgs.leaseToken,
            customerName: rawArgs.customerName || 'Pelanggan',
            customerPhone: rawArgs.customerPhone || '-',
            notes: rawArgs.notes,
            actor: 'AI Assistant',
          });

          if (commitResult.success && commitResult.reservation) {
            IdempotencyManager.commit(idempotencyKey, commitResult.reservation);

            // Publish domain event
            DomainEventBus.publish({
              eventType: 'reservation.created',
              tenantId,
              traceId,
              payload: commitResult.reservation,
            });
          } else {
            IdempotencyManager.fail(idempotencyKey);
          }

          return {
            tool: toolName,
            success: commitResult.success,
            data: commitResult.reservation || null,
            message: commitResult.message,
          };
        }

        case 'get_reservation': {
          const res = ReservationService.getReservation(rawArgs.code);
          if (!res) {
            return {
              tool: toolName,
              success: false,
              data: null,
              message: `Reservasi dengan kode "${rawArgs.code}" tidak ditemukan.`,
            };
          }
          return {
            tool: toolName,
            success: true,
            data: res,
            message: `Data reservasi ${res.code} (${res.customerName}) ditemukan. Status: ${res.status}. Waktu: ${res.date} ${res.time} WIB. Meja: ${res.tableNumber} (${res.tableArea}).`,
          };
        }

        case 'cancel_reservation': {
          const cancelResult = ReservationService.cancelReservation(rawArgs.code);
          if (cancelResult.success) {
            DomainEventBus.publish({
              eventType: 'reservation.cancelled',
              tenantId,
              traceId,
              payload: { code: rawArgs.code, reason: rawArgs.reason },
            });
          }
          return {
            tool: toolName,
            success: cancelResult.success,
            data: null,
            message: cancelResult.message,
          };
        }

        case 'update_reservation': {
          const updateResult = ReservationService.updateReservation(rawArgs.code, {
            date: rawArgs.newDate,
            time: rawArgs.newTime,
            guestCount: rawArgs.newGuestCount,
          });

          if (updateResult.success && updateResult.reservation) {
            DomainEventBus.publish({
              eventType: 'reservation.updated',
              tenantId,
              traceId,
              payload: updateResult.reservation,
            });
          }

          return {
            tool: toolName,
            success: updateResult.success,
            data: updateResult.reservation || null,
            message: updateResult.message,
          };
        }

        case 'calculate_order_total': {
          const items = (rawArgs.items || []) as Array<{ menuItemId: string; quantity: number }>;
          let subtotal = 0;
          const detailedItems: any[] = [];

          for (const it of items) {
            const menuItem = restaurantStore.getMenuItems().find((m) => m.id === it.menuItemId);
            if (menuItem) {
              const itemTotal = menuItem.price * it.quantity;
              subtotal += itemTotal;
              detailedItems.push({
                ...menuItem,
                quantity: it.quantity,
                itemTotal,
              });
            }
          }

          const tax = Math.round(subtotal * 0.1);
          const total = subtotal + tax;

          return {
            tool: toolName,
            success: true,
            data: { detailedItems, subtotal, tax, total },
            message: `Estimasi total ${items.length} menu: Rp ${total.toLocaleString('id-ID')} (termasuk PB1 10%).`,
          };
        }

        case 'contact_human': {
          DomainEventBus.publish({
            eventType: 'human.handoff.requested',
            tenantId,
            traceId,
            payload: { conversationId, reason: rawArgs.reason },
          });

          return {
            tool: toolName,
            success: true,
            data: { handoff: true },
            message: 'Percakapan telah dialihkan ke tim staf restoran.',
          };
        }

        default:
          return {
            tool: toolName,
            success: false,
            data: null,
            message: `Tool "${toolName}" tidak dikenal dalam sistem.`,
            errorCode: 'UNKNOWN_TOOL',
          };
      }
    } finally {
      endSpan();
    }
  }
}
