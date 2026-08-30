import { NextRequest, NextResponse } from 'next/server';
import { AIOrchestrator } from '../../../lib/ai/orchestrator';
import { ConversationSession } from '../../../lib/ai/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, session } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const currentSession: ConversationSession = session || {
      sessionId: `sess_${Date.now()}`,
      tenantId: 'tenant_rasominang_01',
      state: 'IDLE',
      stateVersion: 1,
      history: [],
      lastInteractionAt: Date.now(),
    };

    const result = await AIOrchestrator.processMessage({
      userMessage: message,
      session: currentSession,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/chat route:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        reply: 'Mohon maaf, terjadi gangguan teknis saat memproses pesan Anda.',
      },
      { status: 500 }
    );
  }
}
