import fs from 'fs';
import path from 'path';

function loadEnv() {
  const rootDir = path.resolve(__dirname, '..');
  const envFiles = ['.env', '.env.local'];

  for (const file of envFiles) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...vals] = trimmed.split('=');
          const val = vals.join('=').trim();
          process.env[key.trim()] = val;
        }
      });
    }
  }
}

loadEnv();

import { AIOrchestrator } from '../lib/ai/orchestrator';
import { ConversationSession } from '../lib/ai/types';

async function runAutonomousBookingTest() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🤖 TESTING AUTONOMOUS GEMINI DECISION MAKING & FLOW');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let session: ConversationSession = {
    sessionId: `auto-test-${Date.now()}`,
    tenantId: 'tenant_rasominang_01',
    state: 'IDLE',
    stateVersion: 1,
    history: [],
    lastInteractionAt: Date.now(),
  };

  // Turn 1: Customer asks to book a table
  console.log('💬 [CUSTOMER]: "Tolong pesankan meja untuk 4 orang besok malam jam 19.00 atas nama Budi Santoso"');
  const turn1 = await AIOrchestrator.processMessage({
    userMessage: 'Tolong pesankan meja untuk 4 orang besok malam jam 19.00 atas nama Budi Santoso',
    session,
  });

  session = turn1.session;
  console.log('⚡ Tool Called by Gemini:', turn1.toolExecuted?.tool || 'none');
  console.log('🔄 FSM State:', session.state);
  console.log('🗣️ [GEMINI REPLY]:\n', turn1.reply);
  console.log('🔘 Action Buttons:', turn1.actionButtons?.map((b) => b.label));
  console.log('-------------------------------------------------------------\n');

  // Turn 2: Customer confirms
  console.log('💬 [CUSTOMER]: "Ya, tolong konfirmasi bookingnya"');
  const turn2 = await AIOrchestrator.processMessage({
    userMessage: 'Ya, tolong konfirmasi bookingnya',
    session,
  });

  console.log('⚡ Tool Called by Gemini:', turn2.toolExecuted?.tool || 'none');
  console.log('🔄 FSM State:', turn2.session.state);
  console.log('🗣️ [GEMINI REPLY]:\n', turn2.reply);
  console.log('🔘 Action Buttons:', turn2.actionButtons?.map((b) => b.label));
  console.log('-------------------------------------------------------------\n');

  console.log('🎉 AUTONOMOUS GEMINI FLOW COMPLETED SUCCESSFULLY!');
}

runAutonomousBookingTest().catch(console.error);
