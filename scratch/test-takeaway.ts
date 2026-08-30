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

async function testFull() {
  const res = await GeminiClient.generateContent({
    systemPrompt: 'Kamu adalah Asisten AI Restoran Padang Raso Minang. Jawab dengan ramah, singkat, dan on-point.',
    history: [
      { role: 'user', content: 'ayam bakar 1, take away' },
      { role: 'assistant', content: 'Siap Kak! 1 porsi Ayam Bakar Padang (Rp 28.000) untuk dibungkus ya. Mau diambil jam berapa?' },
    ],
    userMessage: 'ayam bakar aja, langsung bungkus',
  });

  console.log('Gemini Direct Result:');
  console.log(JSON.stringify(res, null, 2));
}

testFull().catch(console.error);
