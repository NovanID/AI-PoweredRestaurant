import { AIOrchestrator } from './ai/orchestrator';
import { ConversationSession } from './ai/types';
import { DEFAULT_TENANT_ID } from './mock-data';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  toolCall?: {
    name: string;
    params?: any;
    result?: any;
  };
  actionButtons?: Array<{
    label: string;
    action: string;
    payload?: any;
  }>;
}

// Global active session map for in-memory tracking
const activeSessions: Map<string, ConversationSession> = new Map();

function getOrCreateSession(sessionId = 'default-web-session', pendingConfirmation?: any): ConversationSession {
  let session = activeSessions.get(sessionId);
  if (!session) {
    session = {
      sessionId,
      tenantId: DEFAULT_TENANT_ID,
      state: 'IDLE',
      stateVersion: 1,
      history: [],
      lastInteractionAt: Date.now(),
    };
    activeSessions.set(sessionId, session);
  }

  if (pendingConfirmation && !session.pendingAction) {
    session.pendingAction = {
      id: `act_${Date.now()}`,
      type: 'CONFIRM_RESERVATION',
      leaseToken: pendingConfirmation.leaseToken || `lease_compat_${Date.now()}`,
      payload: pendingConfirmation,
      summaryText: 'Reservasi Meja',
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    session.state = 'WAITING_CONFIRMATION';
  }

  return session;
}

export async function processAIChat(
  userMessage: string,
  history: ChatMessage[],
  pendingConfirmation?: any
): Promise<{
  reply: string;
  toolCall?: { name: string; params?: any; result?: any };
  pendingConfirmation?: any;
  actionButtons?: Array<{ label: string; action: string; payload?: any }>;
}> {
  const session = getOrCreateSession('web-client-session', pendingConfirmation);

  // Sync session history
  session.history = (history || []).map((h) => ({
    id: h.id,
    sender: h.sender,
    text: h.text,
    timestamp: h.timestamp,
    toolCall: h.toolCall,
    actionButtons: h.actionButtons,
  }));

  // If in browser, call /api/chat route on server to access server-side GEMINI_API_KEY securely
  if (typeof window !== 'undefined') {
    try {
      // 120-second timeout to allow reasoning models enough time to generate thinking tokens
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, session, stream: false }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const result = await res.json();
        activeSessions.set(session.sessionId, result.session);

        return {
          reply: result.reply,
          toolCall: result.toolExecuted
            ? {
                name: result.toolExecuted.tool,
                params: result.toolExecuted.data,
                result: result.toolExecuted,
              }
            : undefined,
          pendingConfirmation: result.session?.pendingAction?.payload || null,
          actionButtons: result.actionButtons,
        };
      }
    } catch (e) {
      console.warn('Failed calling /api/chat, falling back to local orchestrator:', e);
    }
  }

  // Server-side direct execution fallback
  const result = await AIOrchestrator.processMessage({
    userMessage,
    session,
  });

  activeSessions.set(session.sessionId, result.session);

  return {
    reply: result.reply,
    toolCall: result.toolExecuted
      ? {
          name: result.toolExecuted.tool,
          params: result.toolExecuted.data,
          result: result.toolExecuted,
        }
      : undefined,
    pendingConfirmation: result.session.pendingAction?.payload || null,
    actionButtons: result.actionButtons,
  };
}

/**
 * Vercel AI SDK Real-time Streaming Client for AIChatWidget
 */
export async function streamAIChat({
  userMessage,
  history,
  pendingConfirmation,
  onDelta,
  onToolCall,
  onToolResult,
  onComplete,
  onError,
}: {
  userMessage: string;
  history: ChatMessage[];
  pendingConfirmation?: any;
  onDelta: (textDelta: string) => void;
  onToolCall?: (tool: { name: string; args?: any }) => void;
  onToolResult?: (tool: { name: string; result?: any }) => void;
  onComplete: (data: {
    reply: string;
    toolCall?: { name: string; params?: any; result?: any };
    pendingConfirmation?: any;
    actionButtons?: Array<{ label: string; action: string; payload?: any }>;
  }) => void;
  onError?: (error: any) => void;
}): Promise<void> {
  const session = getOrCreateSession('web-client-session', pendingConfirmation);

  session.history = (history || []).map((h) => ({
    id: h.id,
    sender: h.sender,
    text: h.text,
    timestamp: h.timestamp,
    toolCall: h.toolCall,
    actionButtons: h.actionButtons,
  }));

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ message: userMessage, session, stream: true }),
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    if (!res.body) {
      throw new Error('ReadableStream not supported by browser response');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedReply = '';
    let latestMetadata: any = null;
    let latestToolCall: any = null;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === 'text-delta' && parsed.text) {
            accumulatedReply += parsed.text;
            onDelta(parsed.text);
          } else if (parsed.type === 'tool-call') {
            latestToolCall = { name: parsed.toolName, params: parsed.args };
            onToolCall?.(latestToolCall);
          } else if (parsed.type === 'tool-result') {
            if (latestToolCall && latestToolCall.name === parsed.toolName) {
              latestToolCall.result = parsed.result;
            }
            onToolResult?.({ name: parsed.toolName, result: parsed.result });
          } else if (parsed.type === 'metadata') {
            latestMetadata = parsed;
            if (parsed.session) {
              activeSessions.set(session.sessionId, parsed.session);
            }
          } else if (parsed.type === 'done') {
            if (parsed.reply && !accumulatedReply) {
              accumulatedReply = parsed.reply;
              onDelta(parsed.reply);
            }
          }
        } catch {
          // ignore json chunk parse errors
        }
      }
    }

    onComplete({
      reply: accumulatedReply,
      toolCall: latestMetadata?.toolExecuted
        ? {
            name: latestMetadata.toolExecuted.tool,
            params: latestMetadata.toolExecuted.data,
            result: latestMetadata.toolExecuted,
          }
        : latestToolCall,
      pendingConfirmation: latestMetadata?.session?.pendingAction?.payload || null,
      actionButtons: latestMetadata?.actionButtons || [],
    });
  } catch (err: any) {
    console.error('Error streaming chat:', err);
    onError?.(err);

    // Graceful fallback to non-streaming processAIChat
    try {
      const fallback = await processAIChat(userMessage, history, pendingConfirmation);
      onDelta(fallback.reply);
      onComplete(fallback);
    } catch {
      // ignore
    }
  }
}
