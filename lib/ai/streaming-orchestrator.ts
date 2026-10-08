import { streamText, isStepCount } from 'ai';
import {
  ConversationSession,
  AIMessage,
  PendingAction,
  ToolResult,
} from './types';
import { ConversationStateMachine } from './state-machine';
import { ContextEngine } from './context-engine';
import { ToolExecutor } from '../domain/tool-executor';
import { GeminiClient } from './gemini-client';
import { loadTenantRuntimeData } from './tenant-data';
import { ObservabilityManager } from '../infrastructure/observability';
import { Reservation } from '../domain/types';
import { ActionButtonEngine } from './action-button-engine';
import { createRestaurantTools } from './tools';

export class StreamingAIOrchestrator {
  /**
   * Process incoming user message and return a streaming SSE HTTP Response
   */
  public static createStreamResponse(params: {
    userMessage: string;
    session: ConversationSession;
    traceId?: string;
  }): Response {
    const { userMessage, traceId } = params;
    let currentSession = ConversationStateMachine.checkTimeout(params.session);

    const trace = ObservabilityManager.startTrace({
      traceId,
      tenantId: currentSession.tenantId,
      conversationId: currentSession.sessionId,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const endSpan = ObservabilityManager.startSpan(trace.traceId, 'streaming_orchestrator_loop');

        const send = (data: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Controller may already be closed if client disconnected
          }
        };

        try {
          // 1. Record incoming user message into session history
          const userMsgRecord: AIMessage = {
            id: `user_${Date.now()}`,
            sender: 'user',
            text: userMessage,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          };
          currentSession.history = [...currentSession.history, userMsgRecord];

          const lowerUserMsg = userMessage.toLowerCase().trim();

          // 1b. Load THIS tenant's data from PostgreSQL (single source of truth).
          // If the tenant/DB fails, we must NOT answer from another tenant's data.
          const { profile, menuSnapshot, availableTablesCount } = await loadTenantRuntimeData(
            currentSession.tenantId
          );

          // 2. Check cancel active order intent
          if (
            (lowerUserMsg.includes('batal pesan') || lowerUserMsg.includes('batalkan pesan')) &&
            currentSession.metadata?.activeOrder
          ) {
            currentSession.metadata.activeOrder = null;
            currentSession = ConversationStateMachine.transition(currentSession, 'IDLE');
          }

          // 3. Fast deterministic check for takeaway checkout
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
              lowerUserMsg === 'bayar' ||
              lowerUserMsg === 'ya' ||
              lowerUserMsg === 'ok' ||
              lowerUserMsg === 'oke');

          // 4. Fast deterministic check for reservation hold confirmation
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
            const executedToolResult = await ToolExecutor.execute({
              toolName: 'create_takeaway_order',
              rawArgs: {
                customerName: currentSession.metadata?.customerName || `Pelanggan ${profile.name}`,
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

              const replyText = `✅ Pesanan bungkus Anda berhasil dibuat dengan kode **${order.orderCode}**!\n\n💰 **Rincian Pembayaran:**\n• Total: **Rp ${order.total.toLocaleString('id-ID')}** (termasuk PB1 10%)\n\nSilakan klik tombol di bawah untuk bayar langsung via **Midtrans** atau pilih **Bayar Tunai di Kasir** saat pengambilan.`;

              const actionButtons = [
                {
                  label: `💳 Bayar Online Rp ${order.total.toLocaleString('id-ID')}`,
                  action: `pay_snap_${order.orderCode}`,
                  payload: {
                    orderCode: order.orderCode,
                    amount: order.total,
                    customerName: order.customerName,
                  },
                },
                {
                  label: '💵 Bayar Tunai di Kasir',
                  action: 'pay_cash',
                  payload: { message: `Saya akan bayar tunai di kasir untuk pesanan ${order.orderCode}` },
                },
              ];

              send({ type: 'text-delta', text: replyText });
              send({
                type: 'metadata',
                session: currentSession,
                actionButtons,
                toolExecuted: executedToolResult,
              });
              send({ type: 'done', reply: replyText });
              return;
            }
          } else if (isConfirmHoldIntent) {
            const pending = currentSession.pendingAction!;
            const executedToolResult = await ToolExecutor.execute({
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

              const replyText = `🎉 Reservasi Anda **BERHASIL DIKONFIRMASI**!\n\n📋 **Detail Booking:**\n• Kode Tiket: **${res.code}**\n• Meja: **${res.tableNumber} (${res.tableArea})**\n• Waktu: **${res.date} pukul ${res.time} WIB** (${res.guestCount} orang)\n\nTiket sudah tersimpan. Sampai jumpa di ${profile.name}!`;

              const actionButtons = [
                { label: `🎫 Lacak Tiket ${res.code}`, action: `check_code_${res.code}` },
                { label: 'Lihat Menu', action: 'show_menu' },
              ];

              send({ type: 'text-delta', text: replyText });
              send({
                type: 'metadata',
                session: currentSession,
                actionButtons,
                toolExecuted: executedToolResult,
              });
              send({ type: 'done', reply: replyText });
              return;
            }
          }

          // 5. Build Assembled Grounded Context (data already loaded above from PostgreSQL)
          const assembledContext = ContextEngine.buildContext({
            session: currentSession,
            profile,
            menuSnapshot,
            availableTablesCount,
          });

          const fullSystemPrompt = `${assembledContext.systemPrompt}\n\n${assembledContext.operationalFacts}\n\n${assembledContext.customerMemory}\n\nPANDUAN RESPONS:
- Jawab langsung pertanyaan pelanggan secara to-the-point, jelas, dan ramah.
- DILARANG menggunakan kata-kata penundaan (seperti "saya cekkan dulu", "mohon tunggu sebentar").
- Jika memanggil tool booking/hold meja, sertakan teks jawaban konfirmasi ringkas bersamaan.`;

          const messages = [
            ...assembledContext.conversationHistory.map((h) => ({
              role: h.role as 'user' | 'assistant' | 'system',
              content: h.content,
            })),
            { role: 'user' as const, content: userMessage },
          ];

          const toolState: { executedResult?: ToolResult } = {};
          const tools = createRestaurantTools({
            tenantId: currentSession.tenantId,
            conversationId: currentSession.sessionId,
            traceId: trace.traceId,
            onToolExecuted: (res) => {
              toolState.executedResult = res;
            },
          });

          const model = GeminiClient.getAIModel();
          let accumulatedReply = '';

          try {
            const result = streamText({
              model,
              system: fullSystemPrompt,
              messages,
              tools,
              stopWhen: isStepCount(3),
            });

            for await (const part of result.fullStream) {
              if (part.type === 'text-delta') {
                accumulatedReply += part.text;
                send({ type: 'text-delta', text: part.text });
              } else if (part.type === 'tool-call') {
                send({
                  type: 'tool-call',
                  toolName: part.toolName,
                  args: (part as any).input || (part as any).args,
                });
              } else if (part.type === 'tool-result') {
                const toolOutput = (part as any).output || (part as any).result;
                send({
                  type: 'tool-result',
                  toolName: part.toolName,
                  result: toolOutput,
                });
              }
            }
          } catch (llmError: any) {
            console.warn('[AI STREAM ERROR]:', llmError.message);
          }

          const executedToolResult = toolState.executedResult;

          // Fallback if model did not output text or connection failed
          if (!accumulatedReply) {
            accumulatedReply =
              executedToolResult?.message ||
              'Maaf Kak, sambungan ke AI sedang padat. Silakan pilih menu di bawah atau kirim ulang pesan Anda ya.';
            send({ type: 'text-delta', text: accumulatedReply });
          }

          // 6. Handle State Transitions based on executed tools
          let actionButtons: Array<{ label: string; action: string; payload?: any }> = [];

          if (executedToolResult) {
            const toolName = executedToolResult.tool;
            if (toolName === 'request_reservation_hold' && executedToolResult.success && executedToolResult.data) {
              const lease = executedToolResult.data;
              const pendingAction: PendingAction = {
                id: `act_${Date.now()}`,
                type: 'CONFIRM_RESERVATION',
                leaseToken: lease.leaseToken,
                payload: lease,
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
            } else if (toolName === 'confirm_reservation') {
              if (executedToolResult.success) {
                const res = executedToolResult.data as Reservation;
                currentSession = ConversationStateMachine.transition(currentSession, 'COMPLETED', null);
                actionButtons = [
                  { label: `🎫 Lacak Tiket ${res.code}`, action: `check_code_${res.code}` },
                  { label: 'Lihat Menu', action: 'show_menu' },
                ];
              } else {
                currentSession = ConversationStateMachine.transition(currentSession, 'FAILED');
              }
            } else if (toolName === 'get_menu') {
              actionButtons = [
                { label: '🪑 Pesan Meja', action: 'check_tables' },
                { label: '🥘 Menu Lainnya', action: 'show_menu' },
              ];
            } else if (toolName === 'get_reservation') {
              if (executedToolResult.success && executedToolResult.data) {
                const r = executedToolResult.data as Reservation;
                actionButtons = [
                  { label: `Lacak di Panel Tiket`, action: `check_code_${r.code}` },
                  { label: `Batalkan Reservasi`, action: `cancel_${r.code}` },
                ];
              }
            } else if (toolName === 'calculate_order_total' && executedToolResult.success && executedToolResult.data) {
              currentSession = ConversationStateMachine.transition(currentSession, 'ORDERING');
              currentSession.metadata = {
                ...currentSession.metadata,
                activeOrder: {
                  ...executedToolResult.data,
                  isTakeaway: true,
                },
              };
            } else if (toolName === 'create_takeaway_order' && executedToolResult.success && executedToolResult.data) {
              currentSession = ConversationStateMachine.transition(currentSession, 'COMPLETED');
              currentSession.metadata = {
                ...currentSession.metadata,
                activeOrder: null,
                lastTakeawayOrder: executedToolResult.data,
              };
            }
          }

          // 7. Context-Aware Action Buttons fallback
          if (actionButtons.length === 0) {
            actionButtons = ActionButtonEngine.generateButtons({
              userMessage,
              replyText: accumulatedReply,
              toolExecuted: executedToolResult,
              menuSnapshot,
              session: currentSession,
              profile,
            });
          }

          // 8. Record to Session History
          const assistantMsgRecord: AIMessage = {
            id: `asst_${Date.now()}`,
            sender: 'assistant',
            text: accumulatedReply,
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

          // 9. Send metadata and finish event
          send({
            type: 'metadata',
            session: currentSession,
            actionButtons,
            toolExecuted: executedToolResult,
          });

          send({ type: 'done', reply: accumulatedReply });
        } catch (fatalError: any) {
          console.error('[STREAM FATAL ERROR]:', fatalError);
          send({
            type: 'text-delta',
            text: 'Mohon maaf, terjadi gangguan teknis saat memproses pesan Anda.',
          });
          send({
            type: 'done',
            reply: 'Mohon maaf, terjadi gangguan teknis saat memproses pesan Anda.',
          });
        } finally {
          endSpan();
          ObservabilityManager.endTrace(trace.traceId);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }
}
