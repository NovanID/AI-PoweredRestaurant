import { TenantId } from './types';
import { ToolResult } from '../ai/types';
import { ToolRegistry } from '../ai/tool-registry';
import { ReservationService } from './reservation-service';
import { IdempotencyManager } from '../infrastructure/idempotency';
import { DomainEventBus } from '../infrastructure/event-bus';
import { ObservabilityManager } from '../infrastructure/observability';
import { PrismaRestaurantRepository } from '../db/prisma-repository';
import { OramaMenuIndex } from '../search/orama-menu-index';

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
      // 1. Strict Zod Schema validation and parameter coercion
      const validation = ToolRegistry.validateWithZod(toolName, rawArgs);
      if (!validation.success) {
        return {
          tool: toolName,
          success: false,
          data: null,
          message: `Parameter tool tidak valid: ${validation.errors?.join(', ')}`,
          errorCode: 'INVALID_PARAMETERS',
        };
      }

      const args = validation.data || {};

      // 2. Dispatch to specific domain service
      switch (toolName) {
        case 'get_restaurant_info': {
          // PostgreSQL only — a DB failure must surface as a tool failure,
          // never as another tenant's (or mock) profile.
          const profile = await PrismaRestaurantRepository.getProfile(tenantId);
          if (!profile) {
            return {
              tool: toolName,
              success: false,
              data: null,
              message: `Data restoran untuk tenant "${tenantId}" tidak ditemukan.`,
              errorCode: 'TENANT_NOT_FOUND',
            };
          }

          return {
            tool: toolName,
            success: true,
            data: profile,
            message: `Informasi ${profile.name}: ${profile.tagline}. Alamat: ${profile.address}, ${profile.city}. Jam Buka: ${profile.openTime} - ${profile.closeTime} WIB. Kontak: ${profile.phone}.`,
          };
        }

        case 'get_menu': {
          const { category, search, maxPrice, spicinessLevel } = args;
          let items: any[] = [];

          // 1. If search term is provided, use Orama fuzzy typo-tolerant search
          //    (index is loaded from PostgreSQL per tenant)
          if (search && typeof search === 'string' && search.trim().length > 0) {
            try {
              items = await OramaMenuIndex.searchMenu(search, {
                tenantId,
                category: category || undefined,
                maxPrice: maxPrice ? Number(maxPrice) : undefined,
                spicinessLevel: spicinessLevel ? Number(spicinessLevel) : undefined,
              });
            } catch (oramaErr) {
              console.warn('[ToolExecutor] Orama search error, falling back to SQL:', oramaErr);
            }
          }

          // 2. If no search term or Orama produced 0 hits, query PostgreSQL.
          //    Multi-word searches retry per word (SQL ILIKE contains).
          if (items.length === 0) {
            items = await PrismaRestaurantRepository.getMenuItems({
              tenantId,
              category,
              search,
              maxPrice: maxPrice ? Number(maxPrice) : undefined,
              spicinessLevel: spicinessLevel ? Number(spicinessLevel) : undefined,
            });

            if (items.length === 0 && search && typeof search === 'string') {
              const words = search.split(/\s+/).filter((w: string) => w.length > 2);
              for (const word of words) {
                const perWord = await PrismaRestaurantRepository.getMenuItems({
                  tenantId,
                  category,
                  search: word,
                  maxPrice: maxPrice ? Number(maxPrice) : undefined,
                  spicinessLevel: spicinessLevel ? Number(spicinessLevel) : undefined,
                });
                if (perWord.length > 0) {
                  items = perWord;
                  break;
                }
              }
            }
          }

          return {
            tool: toolName,
            success: true,
            data: items,
            message: items.length > 0 ? `Ditemukan ${items.length} menu yang cocok.` : `Menu "${search}" tidak ditemukan.`,
          };
        }

        case 'check_availability': {
          // ReservationService already goes straight to PostgreSQL + Redis holds.
          const result = await ReservationService.checkAvailability({
            tenantId,
            date: args.date,
            time: args.time,
            guestCount: args.guestCount,
            preferredArea: args.preferredArea,
          });

          return {
            tool: toolName,
            success: result.available,
            data: result,
            message: result.available
              ? `Tersedia ${result.availableTables.length} meja yang cocok untuk ${args.guestCount} orang pada ${args.date} pukul ${args.time} WIB.`
              : (result.reason || 'Meja tidak tersedia.'),
          };
        }

        case 'request_reservation_hold': {
          const holdResult = await ReservationService.createHoldLease({
            tenantId,
            conversationId,
            customerName: args.customerName,
            customerPhone: args.customerPhone || '-',
            date: args.date,
            time: args.time,
            guestCount: args.guestCount,
            preferredArea: args.preferredArea,
            notes: args.notes,
          });

          return {
            tool: toolName,
            success: holdResult.success,
            data: holdResult.lease || null,
            message: holdResult.message,
          };
        }

        case 'confirm_reservation': {
          const idempotencyKey = args.idempotencyKey || `idem_res_${args.leaseToken}`;
          const idCheck = IdempotencyManager.acquire(idempotencyKey);

          if (!idCheck.acquired && idCheck.existingRecord?.status === 'COMMITTED') {
            return {
              tool: toolName,
              success: true,
              data: idCheck.existingRecord.responsePayload,
              message: 'Reservasi ini telah berhasil dikonfirmasi sebelumnya (idempotent result).',
            };
          }

          // commitLeasedReservation persists to PostgreSQL itself and returns
          // success:false when the DB write fails — no separate write here.
          const commitResult = await ReservationService.commitLeasedReservation({
            leaseToken: args.leaseToken,
            customerName: args.customerName || 'Pelanggan',
            customerPhone: args.customerPhone || '-',
            notes: args.notes,
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
          // Tenant-scoped PostgreSQL lookup only
          const res = await PrismaRestaurantRepository.getReservationByCode(tenantId, args.code);

          if (!res) {
            return {
              tool: toolName,
              success: false,
              data: null,
              message: `Reservasi dengan kode "${args.code}" tidak ditemukan.`,
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
          const cancelResult = await ReservationService.cancelReservation(tenantId, args.code, args.reason);
          if (cancelResult.success) {
            DomainEventBus.publish({
              eventType: 'reservation.cancelled',
              tenantId,
              traceId,
              payload: { code: args.code, reason: args.reason },
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
          const updateResult = await ReservationService.updateReservation(tenantId, args.code, {
            date: args.newDate,
            time: args.newTime,
            guestCount: args.newGuestCount,
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
          const items = (args.items || []) as Array<{ menuItemId?: string; menuName?: string; name?: string; quantity?: number }>;
          let subtotal = 0;
          const detailedItems: any[] = [];
          const allMenu = await PrismaRestaurantRepository.getMenuItems({ tenantId });

          for (const it of items) {
            const query = (it.menuName || it.name || it.menuItemId || '').trim().toLowerCase();
            if (!query) continue;

            const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
            // Search by exact ID, or substring match on name
            let menuItem = allMenu.find((m) => {
              const mId = m.id.toLowerCase();
              const mName = m.name.toLowerCase();
              return mId === query || mName === query || mName.includes(query) || query.includes(mName);
            });

            // If not found, use Orama fuzzy search with typo tolerance (e.g. "rendng" -> Rendang)
            if (!menuItem) {
              try {
                const fuzzyMatch = await OramaMenuIndex.findBestMatch(query, tenantId);
                if (fuzzyMatch) {
                  menuItem = fuzzyMatch;
                }
              } catch (oramaErr) {
                console.warn('[ToolExecutor] Orama findBestMatch failed:', oramaErr);
              }
            }

            if (menuItem) {
              const itemTotal = menuItem.price * qty;
              subtotal += itemTotal;
              detailedItems.push({
                ...menuItem,
                quantity: qty,
                itemTotal,
              });
            }
          }

          if (detailedItems.length === 0) {
            return {
              tool: toolName,
              success: false,
              data: null,
              message: 'Menu pesanan belum ditentukan atau tidak ditemukan di katalog. Silakan sebutkan nama menu (misal: Rendang Daging Sapi, Ayam Pop, Dendeng Batokok).',
              errorCode: 'ITEMS_NOT_FOUND',
            };
          }

          const tax = Math.round(subtotal * 0.1);
          const total = subtotal + tax;
          const itemsSummary = detailedItems
            .map((d) => `${d.quantity}x ${d.name} (Rp ${d.itemTotal.toLocaleString('id-ID')})`)
            .join(', ');

          return {
            tool: toolName,
            success: true,
            data: { detailedItems, subtotal, tax, total },
            message: `Estimasi pesanan: ${itemsSummary}. Subtotal: Rp ${subtotal.toLocaleString('id-ID')}, PB1 (10%): Rp ${tax.toLocaleString('id-ID')}, Total: Rp ${total.toLocaleString('id-ID')}.`,
          };
        }

        case 'create_takeaway_order': {
          const items = (args.items || []) as Array<{ menuItemId?: string; menuName?: string; name?: string; quantity?: number; notes?: string }>;
          let subtotal = 0;
          const orderItems: any[] = [];
          const allMenu = await PrismaRestaurantRepository.getMenuItems({ tenantId });

          for (const it of items) {
            const query = (it.menuName || it.name || it.menuItemId || '').trim().toLowerCase();
            if (!query) continue;

            const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
            let menuItem = allMenu.find((m) => {
              const mId = m.id.toLowerCase();
              const mName = m.name.toLowerCase();
              return mId === query || mName === query || mName.includes(query) || query.includes(mName);
            });

            // If not found, use Orama fuzzy search with typo tolerance
            if (!menuItem) {
              try {
                const fuzzyMatch = await OramaMenuIndex.findBestMatch(query, tenantId);
                if (fuzzyMatch) {
                  menuItem = fuzzyMatch;
                }
              } catch (oramaErr) {
                console.warn('[ToolExecutor] Orama findBestMatch failed:', oramaErr);
              }
            }

            if (menuItem) {
              const itemTotal = menuItem.price * qty;
              subtotal += itemTotal;
              orderItems.push({
                menuItemId: menuItem.id,
                name: menuItem.name,
                price: menuItem.price,
                quantity: qty,
                notes: it.notes,
              });
            }
          }

          if (orderItems.length === 0) {
            return {
              tool: toolName,
              success: false,
              data: null,
              message: 'Tidak ada item menu valid untuk dibuatkan pesanan bungkus.',
              errorCode: 'ITEMS_NOT_FOUND',
            };
          }

          const tax = Math.round(subtotal * 0.1);
          const total = subtotal + tax;

          const created = await PrismaRestaurantRepository.createTakeawayOrder({
            tenantId,
            customerName: args.customerName || 'Pelanggan Takeaway',
            customerPhone: args.customerPhone || '-',
            items: orderItems,
            notes: args.notes,
          });

          const itemsSummary = orderItems
            .map((d) => `${d.quantity}x ${d.name}`)
            .join(', ');

          return {
            tool: toolName,
            success: true,
            data: {
              orderCode: created.code,
              items: orderItems,
              itemsSummary,
              subtotal,
              tax,
              total,
              reservation: created,
            },
            message: `Pesanan bungkus resmi berhasil dibuat! Kode Tiket: ${created.code}. Rincian: ${itemsSummary}. Total: Rp ${total.toLocaleString('id-ID')} (Termasuk PB1 10%). Silakan selesaikan pembayaran untuk diproses dapur.`,
          };
        }

        case 'contact_human': {
          DomainEventBus.publish({
            eventType: 'human.handoff.requested',
            tenantId,
            traceId,
            payload: { conversationId, reason: args.reason },
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
