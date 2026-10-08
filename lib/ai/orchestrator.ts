import type {
  AIChatRequest,
  AIChatResponse,
  AIIntent,
  LLMMessage,
  LLMProvider,
  PendingConfirmation,
  ToolCallRequest,
  ToolCallTrace,
} from './types.ts';
import { RESTAURANT_ASSISTANT_SYSTEM_PROMPT } from './prompts/restaurant-assistant.ts';
import { createOpenRouterProvider } from './providers/openrouter.ts';
import { routeModel } from './routing/model-router.ts';
import { PROTECTED_TOOL_NAMES } from './tools/definitions.ts';
import { executeAITool } from './tools/executor.ts';
import { getLLMToolDefinitions } from './tools/registry.ts';
import { createAITrace } from './trace.ts';

export interface ProcessAIChatOptions {
  provider?: LLMProvider;
}

const EMPTY_HELP =
  'Halo! Saya AI Assistant Raso Minang. Saya bisa membantu informasi restoran, menu, ketersediaan meja, dan reservasi.';

function isConfirming(text: string): boolean {
  const normalized = text.toLowerCase();
  return ['ya', 'setuju', 'oke', 'ok', 'lanjut', 'konfirmasi', 'benar'].some((word) =>
    normalized.includes(word)
  );
}

function isRejecting(text: string): boolean {
  const normalized = text.toLowerCase();
  return ['batal', 'tidak', 'gak'].some((word) => normalized.includes(word));
}

function isProtectedTool(name: string): boolean {
  return PROTECTED_TOOL_NAMES.includes(name as any);
}

function baseResponse(params: {
  reply: string;
  intent: AIIntent;
  modelUsed: string;
  routeReason: string;
  toolCalls?: ToolCallTrace[];
  pendingConfirmation?: PendingConfirmation | null;
  actionButtons?: AIChatResponse['actionButtons'];
}): AIChatResponse {
  return {
    reply: params.reply,
    intent: params.intent,
    modelUsed: params.modelUsed,
    routeReason: params.routeReason,
    toolCalls: params.toolCalls || [],
    pendingConfirmation: params.pendingConfirmation ?? null,
    actionButtons: params.actionButtons,
  };
}

function buildConfirmationSummary(call: ToolCallRequest): string {
  const args = call.arguments;
  if (call.name === 'create_reservation') {
    return `Membuat reservasi atas nama ${args.customerName || 'customer'} untuk ${args.guestCount || '-'} orang pada ${args.date || '-'} pukul ${args.time || '-'}.`;
  }
  if (call.name === 'update_reservation') {
    return `Mengubah reservasi ${args.code || '-'} ke jadwal/detail baru.`;
  }
  if (call.name === 'cancel_reservation') {
    return `Membatalkan reservasi ${args.code || '-'}.`;
  }
  return `Menjalankan ${call.name}.`;
}

function debugLog(...args: unknown[]) {
  if (process.env.AI_DEBUG === 'true') {
    console.log(...args);
  }
}

function debugError(...args: unknown[]) {
  if (process.env.AI_DEBUG === 'true') {
    console.error(...args);
  }
}

function extractMenuSearchTerm(message: string): string {
  const lower = message.toLowerCase();
  const knownTerms = ['rendang', 'ayam pop', 'dendeng', 'gulai', 'sambal', 'minuman', 'teh talua'];
  return knownTerms.find((term) => lower.includes(term)) || message;
}

function fallbackReadOnlyToolCall(intent: AIIntent, message: string): ToolCallRequest | null {
  if (intent === 'restaurant_info') {
    return { id: 'fallback-get_restaurant_info', name: 'get_restaurant_info', arguments: {} };
  }
  if (intent === 'menu_query') {
    return {
      id: 'fallback-search_menu',
      name: 'search_menu',
      arguments: { search: extractMenuSearchTerm(message) },
    };
  }
  return null;
}

async function executeReadOnlyToolCalls(calls: ToolCallRequest[]): Promise<ToolCallTrace[]> {
  const traces: ToolCallTrace[] = [];
  for (const call of calls) {
    const result = await executeAITool(call);
    traces.push({
      id: call.id,
      name: call.name,
      arguments: call.arguments,
      result,
      protected: false,
    });
  }
  return traces;
}

function replyFromToolTraces(traces: ToolCallTrace[]): string {
  return traces
    .map((trace) => trace.result?.userSafeMessage || trace.result?.message)
    .filter(Boolean)
    .join('\n\n');
}

function messagesFromRequest(request: AIChatRequest): LLMMessage[] {
  const history = (request.history || []).slice(-10).map((message): LLMMessage => ({
    role: message.sender === 'assistant' ? 'assistant' : message.sender === 'system' ? 'system' : 'user',
    content: message.text,
  }));

  return [
    { role: 'system', content: RESTAURANT_ASSISTANT_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: request.message },
  ];
}

async function executeConfirmedTool(
  confirmation: PendingConfirmation,
  intent: AIIntent,
  modelUsed: string,
  routeReason: string
): Promise<AIChatResponse> {
  const call: ToolCallRequest = {
    id: `confirmed-${confirmation.toolName}`,
    name: confirmation.toolName,
    arguments: confirmation.arguments,
  };
  const result = await executeAITool(call);
  const trace: ToolCallTrace = {
    id: call.id,
    name: call.name,
    arguments: call.arguments,
    result,
    protected: true,
  };

  return baseResponse({
    reply: result.userSafeMessage || result.message,
    intent,
    modelUsed,
    routeReason,
    toolCalls: [trace],
    actionButtons: result.success
      ? [
          { label: 'Cek Status Reservasi', action: 'track_reservation' },
          { label: 'Lihat Menu', action: 'show_menu' },
        ]
      : undefined,
  });
}

export async function processAIChatServer(
  request: AIChatRequest,
  options: ProcessAIChatOptions = {}
): Promise<AIChatResponse> {
  const started = Date.now();
  const message = (request.message || '').trim();
  const route = routeModel(message);
  const provider = options.provider || createOpenRouterProvider();

  if (!message) {
    return baseResponse({
      reply: EMPTY_HELP,
      intent: 'general_chat',
      modelUsed: route.model,
      routeReason: 'empty-message',
    });
  }

  if (request.pendingConfirmation) {
    if (isConfirming(message)) {
      return executeConfirmedTool(request.pendingConfirmation, route.intent, route.model, 'pending-confirmation');
    }
    if (isRejecting(message)) {
      return baseResponse({
        reply: 'Baik, aksi tersebut dibatalkan. Ada hal lain yang bisa saya bantu?',
        intent: route.intent,
        modelUsed: route.model,
        routeReason: 'pending-confirmation-cancelled',
      });
    }
  }

  try {
    const llmOutput = await provider.chat({
      model: route.model,
      messages: messagesFromRequest(request),
      tools: getLLMToolDefinitions(),
    });

    if (llmOutput.toolCalls.length > 0) {
      const protectedCall = llmOutput.toolCalls.find((call) => isProtectedTool(call.name));
      if (protectedCall) {
        const summary = buildConfirmationSummary(protectedCall);
        const pendingConfirmation: PendingConfirmation = {
          toolName: protectedCall.name,
          arguments: protectedCall.arguments,
          summary,
        };
        return baseResponse({
          reply: `${summary}\n\nMohon konfirmasi terlebih dahulu. Ketik "Ya, konfirmasi" untuk melanjutkan atau "Batal" untuk membatalkan.`,
          intent: route.intent,
          modelUsed: route.model,
          routeReason: route.routeReason,
          toolCalls: [],
          pendingConfirmation,
          actionButtons: [
            { label: '✅ Ya, Konfirmasi', action: 'confirm_pending_booking' },
            { label: '❌ Batal', action: 'cancel_booking_prompt' },
          ],
        });
      }

      const traces = await executeReadOnlyToolCalls(llmOutput.toolCalls);
      const reply = replyFromToolTraces(traces);

      const trace = createAITrace({
        intent: route.intent,
        modelUsed: route.model,
        routeReason: route.routeReason,
        toolCalls: traces,
        latencyMs: Date.now() - started,
        success: traces.every((item) => item.result?.success),
      });
      debugLog('[AI Trace]', trace);

      return baseResponse({
        reply: reply || 'Data berhasil diambil dari tool restoran.',
        intent: route.intent,
        modelUsed: route.model,
        routeReason: route.routeReason,
        toolCalls: traces,
      });
    }

    const fallbackCall = fallbackReadOnlyToolCall(route.intent, message);
    if (fallbackCall) {
      const traces = await executeReadOnlyToolCalls([fallbackCall]);
      const reply = replyFromToolTraces(traces);
      return baseResponse({
        reply: reply || 'Data berhasil diambil dari tool restoran.',
        intent: route.intent,
        modelUsed: route.model,
        routeReason: `${route.routeReason}:forced-tool`,
        toolCalls: traces,
      });
    }

    if (llmOutput.content.trim()) {
      return baseResponse({
        reply: llmOutput.content,
        intent: route.intent,
        modelUsed: route.model,
        routeReason: route.routeReason,
      });
    }

    return baseResponse({
      reply: 'Maaf, saya belum mendapatkan jawaban yang cukup jelas. Bisa ulangi pertanyaannya?',
      intent: route.intent,
      modelUsed: route.model,
      routeReason: route.routeReason,
    });
  } catch (error) {
    debugError('[AI Orchestrator] Failed to process chat:', error);
    return baseResponse({
      reply: 'Maaf, AI Assistant sedang mengalami kendala. Silakan coba lagi sebentar lagi.',
      intent: route.intent,
      modelUsed: route.model,
      routeReason: route.routeReason,
    });
  }
}
