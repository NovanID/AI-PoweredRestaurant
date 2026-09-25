import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AIOrchestrator } from '../../../lib/ai/orchestrator';
import { StreamingAIOrchestrator } from '../../../lib/ai/streaming-orchestrator';
import { ConversationSession } from '../../../lib/ai/types';
import { DEFAULT_TENANT_ID } from '../../../lib/mock-data';

const ChatRequestBodySchema = z.object({
  message: z.string().trim().min(1, 'Pesan chat wajib diisi dan tidak boleh kosong.'),
  session: z
    .object({
      sessionId: z.string().optional(),
      tenantId: z.string().optional(),
      state: z.any().optional(),
      stateVersion: z.number().optional(),
      history: z.array(z.any()).optional(),
      lastInteractionAt: z.number().optional(),
    })
    .passthrough()
    .optional(),
  stream: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = ChatRequestBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { message, session, stream } = parseResult.data;

    const currentSession: ConversationSession = (session as ConversationSession) || {
      sessionId: `sess_${Date.now()}`,
      tenantId: DEFAULT_TENANT_ID,
      state: 'IDLE',
      stateVersion: 1,
      history: [],
      lastInteractionAt: Date.now(),
    };

    // If client explicitly requests non-streaming JSON (e.g. automated test scripts)
    if (stream === false) {
      const result = await AIOrchestrator.processMessage({
        userMessage: message,
        session: currentSession,
      });
      return NextResponse.json(result);
    }

    // Default: Vercel AI SDK Real-time SSE Stream
    return StreamingAIOrchestrator.createStreamResponse({
      userMessage: message,
      session: currentSession,
    });
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
