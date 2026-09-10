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

async function findAvailableModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  const candidateModels = [
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash',
  ];

  for (const m of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Halo apa kabar?' }] }],
        }),
      });

      console.log(`Model [${m}] -> Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [${m}] SUCCESS! Reply:`, data.candidates?.[0]?.content?.parts?.[0]?.text);
        return m;
      } else {
        const err = await res.json();
        console.log(`❌ [${m}] Error:`, err.error?.message?.substring(0, 120));
      }
    } catch (e: any) {
      console.log(`❌ [${m}] Exception:`, e.message);
    }
  }
}

findAvailableModel().catch(console.error);
