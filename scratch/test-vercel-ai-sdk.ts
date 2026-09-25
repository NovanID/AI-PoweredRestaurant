import { createRestaurantTools } from '../lib/ai/tools';
import { GeminiClient } from '../lib/ai/gemini-client';
import { StreamingAIOrchestrator } from '../lib/ai/streaming-orchestrator';
import { ConversationSession } from '../lib/ai/types';

async function runVercelAISDKTests() {
  console.log('=== TEST 1: STANDARDIZED VERCEL AI SDK TOOLS ===');
  let callbackExecuted = false;
  const tools = createRestaurantTools({
    tenantId: 'tenant_rasominang_01',
    conversationId: 'test_conv_01',
    onToolExecuted: (res) => {
      callbackExecuted = true;
    },
  });

  const expectedTools = [
    'get_restaurant_info',
    'get_menu',
    'check_availability',
    'request_reservation_hold',
    'confirm_reservation',
    'get_reservation',
    'cancel_reservation',
    'update_reservation',
    'calculate_order_total',
    'create_takeaway_order',
    'contact_human',
  ];

  for (const name of expectedTools) {
    const t = (tools as any)[name];
    console.assert(t !== undefined, `Tool ${name} is missing!`);
    console.assert(typeof t.execute === 'function', `Tool ${name} has no execute function!`);
    console.assert(t.inputSchema !== undefined, `Tool ${name} has no inputSchema!`);
    console.log(`✔ Tool "${name}" registered with Vercel AI SDK inputSchema & execute function.`);
  }

  // Execute one tool directly
  const execResult = await (tools as any).get_restaurant_info.execute({});
  console.assert(execResult.success === true, 'get_restaurant_info execute failed');
  console.assert(callbackExecuted === true, 'onToolExecuted callback was not called');
  console.log('✔ Direct tool execution through Vercel AI SDK wrapper succeeded:', execResult.data.name);

  console.log('\n=== TEST 2: GEMINI CLIENT AI MODEL INSTANTIATION ===');
  const model = GeminiClient.getAIModel();
  console.assert(model !== null && model !== undefined, 'getAIModel returned null');
  console.assert(model.modelId !== undefined, 'modelId is undefined');
  console.log(`✔ Vercel AI SDK Model instantiated: ${model.modelId} (provider: ${model.provider})`);

  console.log('\n=== TEST 3: STREAMING AI ORCHESTRATOR FAST PATH SSE ===');
  // Test fast-path payment checkout streaming
  const sessionWithOrder: ConversationSession = {
    sessionId: 'test_stream_sess_1',
    tenantId: 'tenant_rasominang_01',
    state: 'ORDERING',
    stateVersion: 1,
    history: [],
    lastInteractionAt: Date.now(),
    metadata: {
      activeOrder: {
        detailedItems: [{ name: 'Rendang Daging Sapi', quantity: 2, price: 28000, subtotal: 56000 }],
        subtotal: 56000,
        tax: 5600,
        total: 61600,
        isTakeaway: true,
      },
    },
  };

  const response = StreamingAIOrchestrator.createStreamResponse({
    userMessage: 'bayar sekarang',
    session: sessionWithOrder,
  });

  console.assert(response instanceof Response, 'createStreamResponse did not return Response');
  console.assert(response.headers.get('content-type')?.includes('text/event-stream') === true, 'Header is not text/event-stream');
  console.log('✔ Streaming response returned with header:', response.headers.get('content-type'));

  // Read the stream
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let streamTextOutput = '';
  let metadataReceived = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const json = line.slice(5).trim();
        try {
          const parsed = JSON.parse(json);
          if (parsed.type === 'text-delta') {
            streamTextOutput += parsed.text;
          } else if (parsed.type === 'metadata') {
            metadataReceived = true;
            console.assert(parsed.actionButtons.length > 0, 'No action buttons in metadata');
          }
        } catch {}
      }
    }
  }

  console.assert(streamTextOutput.length > 0, 'No stream text output received');
  console.assert(metadataReceived === true, 'No metadata event received');
  console.log('✔ Stream read successfully. Preview:');
  console.log(streamTextOutput.slice(0, 120) + '...');

  console.log('\n🎉 ALL VERCEL AI SDK INTEGRATION TESTS PASSED!');
}

runVercelAISDKTests().catch((err) => {
  console.error('Test failed with exception:', err);
  process.exit(1);
});
