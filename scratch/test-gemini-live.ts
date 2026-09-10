import fs from 'fs';
import path from 'path';

// Helper to load .env.local and .env
function loadEnv() {
  const rootDir = path.resolve(__dirname, '..');
  const envFiles = ['.env.local', '.env'];

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

import { GeminiClient } from '../lib/ai/gemini-client';
import { AIOrchestrator } from '../lib/ai/orchestrator';
import { ConversationSession } from '../lib/ai/types';

async function testGeminiLive() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🌟 TESTING LIVE GOOGLE GEMINI API INTEGRATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  console.log('🔑 Gemini API Key Status:', apiKey ? `✅ DETECTED (${apiKey.substring(0, 6)}...${apiKey.slice(-4)})` : '❌ NOT FOUND');
  console.log('🤖 Model Target:', process.env.GEMINI_MODEL || 'gemini-1.5-flash');
  console.log('-------------------------------------------------------------\n');

  if (!apiKey) {
    console.error('⚠️ Silakan masukkan GEMINI_API_KEY ke dalam .env.local terlebih dahulu.');
    return;
  }

  // 1. Test Direct Gemini Call with Function Calling
  console.log('🔹 [STEP 1] Direct Function Calling Test with Gemini...');
  const directTest = await GeminiClient.generateContent({
    systemPrompt: 'Kamu adalah Asisten AI Restoran Padang Raso Minang. Gunakan tool yang tersedia untuk melayani pelanggan.',
    history: [],
    userMessage: 'Mbak, ada meja untuk 4 orang besok jam 19.00 atas nama Budi?',
  });

  if (directTest) {
    console.log('✅ Gemini Connected Successfully!');
    console.log('Generated Text:', directTest.replyText || '(No direct text, tool requested)');
    console.log('Tool Calls Detected:', JSON.stringify(directTest.toolCalls, null, 2));
  } else {
    console.log('❌ Gemini Call Failed or returned null. Cek kuota / API Key Anda.');
  }

  console.log('\n-------------------------------------------------------------\n');

  // 2. Test Full End-to-End Orchestrator Loop with Gemini
  console.log('🔹 [STEP 2] End-to-End Conversation Orchestrator with Gemini...');
  let session: ConversationSession = {
    sessionId: 'gemini-test-session',
    tenantId: 'tenant_rasominang_01',
    state: 'IDLE',
    stateVersion: 1,
    history: [],
    lastInteractionAt: Date.now(),
  };

  const orchResult = await AIOrchestrator.processMessage({
    userMessage: 'Rekomendasikan 2 menu paling favorit yang pedas dan harganya di bawah 40 ribu dong!',
    session,
  });

  console.log('State:', orchResult.session.state);
  console.log('AI Reply:\n', orchResult.reply);
  console.log('Tool Executed:', orchResult.toolExecuted?.tool);
  console.log('Action Buttons:', orchResult.actionButtons?.map((b) => b.label));
  console.log('Validation:', orchResult.validation.isValid ? '✅ PASSED' : '❌ FAILED');

  console.log('\n🎉 GEMINI LIVE TEST FINISHED!');
}

testGeminiLive().catch(console.error);
