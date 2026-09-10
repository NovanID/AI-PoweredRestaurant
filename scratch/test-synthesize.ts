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

import { GeminiClient } from '../lib/ai/gemini-client';

async function testSynthesizeDirect() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing synthesize with API key:', apiKey?.substring(0, 8));

  const result = await GeminiClient.synthesizeToolResponse({
    systemPrompt: 'Kamu adalah Asisten AI Restoran Padang Raso Minang yang ramah dan hangat.',
    history: [],
    userMessage: 'ayam bakar',
    toolCall: { name: 'get_menu', arguments: { search: 'ayam bakar' } },
    toolResult: [
      {
        id: 'menu_ayam_bakar',
        name: 'Ayam Bakar Padang',
        price: 28000,
        description: 'Ayam berbalut bumbu kuning rempah dibakar harum arang batok kelapa.',
        spicinessLevel: 2,
        isAvailable: true,
      },
    ],
  });

  console.log('Synthesized Output from Gemini:\n', result);
}

testSynthesizeDirect().catch(console.error);
