import { AIOrchestrator } from './ai/orchestrator';
import { ConversationSession } from './ai/types';

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
      tenantId: 'tenant_rasominang_01',
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, session }),
      });

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
