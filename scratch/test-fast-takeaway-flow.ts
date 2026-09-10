import { AIOrchestrator } from '../lib/ai/orchestrator';
import { ConversationSession } from '../lib/ai/types';
import { restaurantStore } from '../lib/restaurant-store';

async function runTest() {
  console.log('=== START FAST TAKEAWAY TO PAYMENT FLOW TEST ===\n');

  let session: ConversationSession = {
    sessionId: `test_fast_${Date.now()}`,
    tenantId: 'raso-minang-padang-01',
    state: 'IDLE',
    stateVersion: 1,
    history: [],
    lastInteractionAt: Date.now(),
  };

  // Turn 1: "Ayam bakar"
  console.log('--- TURN 1: User says "Ayam bakar" ---');
  const res1 = await AIOrchestrator.processMessage({
    userMessage: 'Ayam bakar',
    session,
  });
  session = res1.session;
  console.log('Reply:', res1.reply);
  console.log('Tool Executed:', res1.toolExecuted?.tool);
  console.log('Action Buttons:', res1.actionButtons?.map((b) => `[${b.label} -> ${b.action}]`));

  // Turn 2: "Saya mau pesan bungkus 1 porsi Ayam Bakar Padang"
  console.log('\n--- TURN 2: User says "Saya mau pesan bungkus 1 porsi Ayam Bakar Padang" ---');
  const res2 = await AIOrchestrator.processMessage({
    userMessage: 'Saya mau pesan bungkus 1 porsi Ayam Bakar Padang',
    session,
  });
  session = res2.session;
  console.log('Reply:', res2.reply);
  console.log('Tool Executed:', res2.toolExecuted?.tool);
  console.log('Session State:', session.state);
  console.log('Active Order in Session:', session.metadata?.activeOrder?.total);
  console.log('Action Buttons:', res2.actionButtons?.map((b) => `[${b.label} -> ${b.action}]`));

  // Turn 3: "Di mana alamat restoran dan buka sampai jam berapa?"
  console.log('\n--- TURN 3: User says "Di mana alamat restoran dan buka sampai jam berapa?" ---');
  const res3 = await AIOrchestrator.processMessage({
    userMessage: 'Di mana alamat restoran dan buka sampai jam berapa?',
    session,
  });
  session = res3.session;
  console.log('Reply:', res3.reply);
  console.log('Tool Executed:', res3.toolExecuted?.tool);
  console.log('Session State:', session.state);
  console.log('Active Order in Session:', session.metadata?.activeOrder?.total);
  console.log('Action Buttons:', res3.actionButtons?.map((b) => `[${b.label} -> ${b.action}]`));

  // Turn 4: "Saya mau lanjut ke pembayaran pesanan ini"
  console.log('\n--- TURN 4: User says "Saya mau lanjut ke pembayaran pesanan ini" ---');
  const res4 = await AIOrchestrator.processMessage({
    userMessage: 'Saya mau lanjut ke pembayaran pesanan ini',
    session,
  });
  session = res4.session;
  console.log('Reply:', res4.reply);
  console.log('Tool Executed:', res4.toolExecuted?.tool);
  console.log('Tool Data:', res4.toolExecuted?.data);
  console.log('Action Buttons:', res4.actionButtons?.map((b) => `[${b.label} -> ${b.action}]`));

  console.log('\n=== TEST COMPLETE ===');
}

runTest().catch(console.error);
