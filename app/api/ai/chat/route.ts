import { NextRequest, NextResponse } from 'next/server.js';
import { processAIChatServer } from '../../../../lib/ai/orchestrator.ts';
import type { AIChatRequest, AIChatResponse } from '../../../../lib/ai/types.ts';

function safeResponse(reply: string, status: number): NextResponse<AIChatResponse> {
  return NextResponse.json(
    {
      reply,
      intent: 'general_chat',
      modelUsed: 'none',
      routeReason: status === 400 ? 'invalid-request' : 'route-error',
      toolCalls: [],
      pendingConfirmation: null,
    },
    { status }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<AIChatRequest>;

    if (typeof body.message !== 'string') {
      return safeResponse('Format pesan tidak valid. Mohon kirim field message berupa teks.', 400);
    }

    const response = await processAIChatServer(body as AIChatRequest);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[AI Chat API] Unexpected error:', error);
    return safeResponse('Maaf, AI Assistant sedang mengalami kendala. Silakan coba lagi sebentar lagi.', 500);
  }
}
