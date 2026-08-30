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

      let replyText = '';
      let executedToolResult: ToolResult | undefined = undefined;
      let actionButtons: Array<{ label: string; action: string; payload?: any }> = [];

      // 2. Build Assembled Grounded Context
      const profile = restaurantStore.getProfile();
      const menuSnapshot = restaurantStore.getMenuItems();
      const availableTablesCount = restaurantStore.getTables().filter((t) => t.status === 'available').length;

      const assembledContext = ContextEngine.buildContext({
        session: currentSession,
        profile,
        menuSnapshot,
        availableTablesCount,
      });

      const fullSystemPrompt = `${assembledContext.systemPrompt}\n\n${assembledContext.operationalFacts}\n\n${assembledContext.customerMemory}`;

      // 3. Call Gemini to Reason and Decide
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
          }

          // Turn 2: Gemini synthesizes 100% of the conversational text from real backend data
          const synthesized = await GeminiClient.synthesizeToolResponse({
            systemPrompt: fullSystemPrompt,
            history: assembledContext.conversationHistory,
            userMessage,
            toolCall: tc,
            toolResult: executedToolResult.data || executedToolResult.message,
          });

          replyText = synthesized || executedToolResult.message;
        } else if (geminiResponse.replyText) {
          // --- CASE B: GEMINI CHOSE TO TALK NATURALLY (DIRECT CONVERSATION) ---
          replyText = geminiResponse.replyText;
          actionButtons = [
            { label: '🥘 Menu Favorit', action: 'show_menu' },
            { label: '🪑 Cek Meja Kosong', action: 'check_tables' },
          ];
        }
      }

      // 4. If AI is unreachable, show raw error info for debugging
      if (!replyText) {
        replyText = `[DEBUG] AI tidak merespon. Cek console log di server untuk detail error.`;
        actionButtons = [{ label: '🔄 Coba Lagi', action: 'retry_last' }];
      }

      // 5. Response Validation
      const validation = ResponseValidator.validate({
        generatedReply: replyText,
        toolExecuted: executedToolResult,
        menuSnapshot,
      });

      const finalReply = validation.sanitizedOutput || replyText;

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
