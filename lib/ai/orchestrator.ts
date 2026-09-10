import {
  ConversationSession,
  OrchestrationResult,
  AIMessage,
  PendingAction,
  ToolResult,
} from './types';
import { ConversationStateMachine } from './state-machine';
import { ContextEngine } from './context-engine';
import { ToolExecutor } from '../domain/tool-executor';
import { ResponseValidator } from './response-validator';
import { GeminiClient } from './gemini-client';
import { restaurantStore } from '../restaurant-store';
import { ObservabilityManager } from '../infrastructure/observability';
import { Reservation } from '../domain/types';
import { ActionButtonEngine } from './action-button-engine';

export class AIOrchestrator {
  /**
   * Pure AI Autonomous Conversation Engine (100% Dynamic Gemini Generation)
   */
  public static async processMessage(params: {
    userMessage: string;
    session: ConversationSession;
    traceId?: string;
  }): Promise<OrchestrationResult> {
    const { userMessage, traceId } = params;
    let currentSession = ConversationStateMachine.checkTimeout(params.session);

    const trace = ObservabilityManager.startTrace({
      traceId,
      tenantId: currentSession.tenantId,
      conversationId: currentSession.sessionId,
    });

    const endOrchSpan = ObservabilityManager.startSpan(trace.traceId, 'orchestrator_loop');

    try {
      // 1. Record incoming user message into session history
      const userMsgRecord: AIMessage = {
        id: `user_${Date.now()}`,
        sender: 'user',
        text: userMessage,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      currentSession.history = [...currentSession.history, userMsgRecord];

      const lowerUserMsg = userMessage.toLowerCase();
      if (
        (lowerUserMsg.includes('batal pesan') || lowerUserMsg.includes('batalkan pesan')) &&
        currentSession.metadata?.activeOrder
      ) {
        currentSession.metadata.activeOrder = null;
        currentSession = ConversationStateMachine.transition(currentSession, 'IDLE');
      }

      // 2. Fetch Restaurant Data
      const profile = restaurantStore.getProfile();
      const menuSnapshot = restaurantStore.getMenuItems();
      const availableTablesCount = restaurantStore.getTables().filter((t) => t.status === 'available').length;

      let replyText = '';
      let executedToolResult: ToolResult | undefined = undefined;
      let actionButtons: Array<{ label: string; action: string; payload?: any }> = [];

      // Fast deterministic check for takeaway checkout when active order exists
      const isProceedPaymentIntent =
        Boolean(currentSession.metadata?.activeOrder) &&
        (lowerUserMsg.includes('lanjut ke pembayaran') ||
          lowerUserMsg.includes('lanjut pembayaran') ||
          lowerUserMsg.includes('bayar pesanan') ||
          lowerUserMsg.includes('bayar sekarang') ||
          lowerUserMsg.includes('bayar midtrans') ||
          lowerUserMsg.includes('mau bayar') ||
          lowerUserMsg.includes('langsung bayar') ||
          lowerUserMsg.includes('checkout') ||
          lowerUserMsg.includes('proses pesanan') ||
          lowerUserMsg.includes('bayar') ||
          lowerUserMsg === 'ya' ||
          lowerUserMsg === 'ok' ||
          lowerUserMsg === 'oke');

      // Fast deterministic check for hold confirmation
      const isConfirmHoldIntent =
        currentSession.pendingAction?.type === 'CONFIRM_RESERVATION' &&
        (lowerUserMsg.includes('konfirmasi booking') ||
          lowerUserMsg.includes('konfirmasi reservasi') ||
          lowerUserMsg.includes('ya konfirmasi') ||
          lowerUserMsg === 'ya, konfirmasi booking' ||
          lowerUserMsg === 'ya' ||
          lowerUserMsg === 'ok' ||
          lowerUserMsg === 'oke');

      if (isProceedPaymentIntent) {
        const ao = currentSession.metadata?.activeOrder;
        executedToolResult = await ToolExecutor.execute({
          toolName: 'create_takeaway_order',
          rawArgs: {
            customerName: currentSession.metadata?.customerName || 'Pelanggan Raso Minang',
            customerPhone: currentSession.metadata?.customerPhone || '-',
            items: ao?.detailedItems || [],
            notes: ao?.notes,
          },
          tenantId: currentSession.tenantId,
          conversationId: currentSession.sessionId,
          traceId: trace.traceId,
        });

        if (executedToolResult.success && executedToolResult.data) {
          const order = executedToolResult.data;
          currentSession = ConversationStateMachine.transition(currentSession, 'COMPLETED');
          currentSession.metadata = {
            ...currentSession.metadata,
            activeOrder: null,
            lastTakeawayOrder: order,
          };
          replyText = `✅ Pesanan bungkus Anda berhasil dibuat dengan kode **${order.orderCode}**!\n\n💰 **Rincian Pembayaran:**\n• Total: **Rp ${order.total.toLocaleString('id-ID')}** (termasuk PB1 10%)\n\nSilakan klik tombol di bawah untuk bayar langsung via **Midtrans** atau pilih **Bayar Tunai di Kasir** saat pengambilan.`;
        }
      } else if (isConfirmHoldIntent) {
        const pending = currentSession.pendingAction!;
        executedToolResult = await ToolExecutor.execute({
          toolName: 'confirm_reservation',
          rawArgs: {
            leaseToken: pending.leaseToken,
            customerName: pending.payload?.customerName || 'Pelanggan',
            customerPhone: pending.payload?.customerPhone || '-',
            notes: pending.payload?.notes,
          },
          tenantId: currentSession.tenantId,
          conversationId: currentSession.sessionId,
          traceId: trace.traceId,
        });

        if (executedToolResult.success && executedToolResult.data) {
          const res = executedToolResult.data as Reservation;
          currentSession = ConversationStateMachine.transition(currentSession, 'COMPLETED', null);
          replyText = `🎉 Reservasi Anda **BERHASIL DIKONFIRMASI**!\n\n📋 **Detail Booking:**\n• Kode Tiket: **${res.code}**\n• Meja: **${res.tableNumber} (${res.tableArea})**\n• Waktu: **${res.date} pukul ${res.time} WIB** (${res.guestCount} orang)\n\nTiket sudah tersimpan. Sampai jumpa di Raso Minang!`;
        }
      } else {
        // 3. Build Assembled Grounded Context
        const assembledContext = ContextEngine.buildContext({
          session: currentSession,
          profile,
          menuSnapshot,
          availableTablesCount,
        });

        const fullSystemPrompt = `${assembledContext.systemPrompt}\n\n${assembledContext.operationalFacts}\n\n${assembledContext.customerMemory}`;

        // 4. Call Gemini to Reason and Decide
        const geminiResponse = await GeminiClient.generateContent({
          systemPrompt: fullSystemPrompt,
          history: assembledContext.conversationHistory,
          userMessage,
        });

        if (geminiResponse) {
          // --- CASE A: GEMINI INVOKED A TOOL ---
          if (geminiResponse.toolCalls && geminiResponse.toolCalls.length > 0) {
            const tc = geminiResponse.toolCalls[0];

            executedToolResult = await ToolExecutor.execute({
              toolName: tc.name,
              rawArgs: tc.arguments,
              tenantId: currentSession.tenantId,
              conversationId: currentSession.sessionId,
              traceId: trace.traceId,
            });

            // State Machine & Domain Action Tracking
            if (tc.name === 'request_reservation_hold') {
              if (executedToolResult.success && executedToolResult.data) {
                const lease = executedToolResult.data;
                const pendingAction: PendingAction = {
                  id: `act_${Date.now()}`,
                  type: 'CONFIRM_RESERVATION',
                  leaseToken: lease.leaseToken,
                  payload: tc.arguments,
                  summaryText: `Meja ${lease.tableNumber} (${lease.tableArea}) untuk ${lease.guestCount} orang pada ${lease.date} pukul ${lease.time} WIB.`,
                  expiresAt: lease.expiresAt,
                };

                currentSession = ConversationStateMachine.transition(
                  currentSession,
                  'WAITING_CONFIRMATION',
                  pendingAction
                );

                actionButtons = [
                  { label: '✅ Ya, Konfirmasi Booking', action: 'confirm_pending_booking' },
                  { label: '❌ Batal', action: 'cancel_booking_prompt' },
                ];
              }
            } else if (tc.name === 'confirm_reservation') {
              if (executedToolResult.success) {
                const res = executedToolResult.data as Reservation;
                currentSession = ConversationStateMachine.transition(currentSession, 'COMPLETED', null);
                actionButtons = [
                  { label: `Lacak Tiket ${res.code}`, action: `check_code_${res.code}` },
                  { label: 'Lihat Menu', action: 'show_menu' },
                ];
              } else {
                currentSession = ConversationStateMachine.transition(currentSession, 'FAILED');
              }
            } else if (tc.name === 'get_menu') {
              actionButtons = [
                { label: '🪑 Pesan Meja', action: 'check_tables' },
                { label: '🥘 Menu Lainnya', action: 'show_menu' },
              ];
            } else if (tc.name === 'get_reservation') {
              if (executedToolResult.success && executedToolResult.data) {
                const r = executedToolResult.data as Reservation;
                actionButtons = [
                  { label: `Lacak di Panel Tiket`, action: `check_code_${r.code}` },
                  { label: `Batalkan Reservasi`, action: `cancel_${r.code}` },
                ];
              }
            } else if (tc.name === 'calculate_order_total') {
              if (executedToolResult.success && executedToolResult.data) {
                currentSession = ConversationStateMachine.transition(currentSession, 'ORDERING');
                currentSession.metadata = {
                  ...currentSession.metadata,
                  activeOrder: {
                    ...executedToolResult.data,
                    isTakeaway: true,
                  },
                };
              }
            } else if (tc.name === 'create_takeaway_order') {
              if (executedToolResult.success && executedToolResult.data) {
                currentSession = ConversationStateMachine.transition(currentSession, 'COMPLETED');
                currentSession.metadata = {
                  ...currentSession.metadata,
                  activeOrder: null,
                  lastTakeawayOrder: executedToolResult.data,
                };
              }
            }

            // If tool failed, prioritize tool error message; otherwise use replyText or tool message
            if (!executedToolResult.success) {
              replyText = executedToolResult.message || geminiResponse.replyText || 'Maaf, pesanan belum dapat diproses.';
            } else {
              replyText = geminiResponse.replyText || executedToolResult.message;
            }
          } else if (geminiResponse.replyText) {
            // --- CASE B: GEMINI CHOSE TO TALK NATURALLY (DIRECT CONVERSATION) ---
            replyText = geminiResponse.replyText;
          }
        }

        // 4. If AI is unreachable, provide graceful fallback
        if (!replyText) {
          replyText = `Maaf Kak, sambungan ke AI sedang padat. Silakan pilih menu di bawah atau kirim ulang pesan Anda ya.`;
        }
      }

      // 5. Response Validation
      const validation = ResponseValidator.validate({
        generatedReply: replyText,
        toolExecuted: executedToolResult,
        menuSnapshot,
      });

      const finalReply = validation.sanitizedOutput || replyText;

      // 6. Generate Dynamic Context-Aware Action Buttons
      actionButtons = ActionButtonEngine.generateButtons({
        userMessage,
        replyText: finalReply,
        toolExecuted: executedToolResult,
        menuSnapshot,
        session: currentSession,
        profile,
      });

      // 6. Record to History
      const assistantMsgRecord: AIMessage = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: finalReply,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        toolCall: executedToolResult
          ? {
              name: executedToolResult.tool,
              params: executedToolResult.data,
              result: executedToolResult,
            }
          : undefined,
        actionButtons,
      };

      currentSession.history = [...currentSession.history, assistantMsgRecord];

      return {
        reply: finalReply,
        session: currentSession,
        toolExecuted: executedToolResult,
        validation,
        actionButtons,
      };
    } finally {
      endOrchSpan();
      ObservabilityManager.endTrace(trace.traceId);
    }
  }
}
