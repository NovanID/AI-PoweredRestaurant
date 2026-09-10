import { ToolRegistry } from './tool-registry';

export interface GeminiResponse {
  replyText: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, any>;
  }>;
  raw?: any;
}

/**
 * AI Client — uses 9router (OpenAI-compatible) at localhost:20128
 * Kept class name "GeminiClient" to avoid touching every import site.
 */
export class GeminiClient {
  private static getBaseUrl(): string {
    return (process.env.AI_BASE_URL || 'http://localhost:20128/v1').trim();
  }

  private static getApiKey(): string {
    const rawKey = process.env.AI_API_KEY || '';
    // Strip non-ASCII characters to prevent "String contains non ISO-8859-1 code point" in HTTP headers
    return rawKey.replace(/[^\x00-\x7F]/g, '').trim();
  }

  private static getModelName(): string {
    return (process.env.AI_MODEL || 'dashscope/qwen-plus').trim();
  }

  private static getTimeoutMs(): number {
    const envTimeout = parseInt(process.env.AI_TIMEOUT_MS || '', 10);
    return !isNaN(envTimeout) && envTimeout > 0 ? envTimeout : 120000; // 120 seconds default for reasoning models
  }

  /**
   * Convert Tool Registry into OpenAI function tools schema
   */
  private static getOpenAITools(): any[] {
    const tools = ToolRegistry.listAvailableTools();
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: t.parameters.properties || {},
          required: t.parameters.required || [],
        },
      },
    }));
  }

  /**
   * Kept for orchestrator compatibility (not used in OpenAI path)
   */
  public static getGeminiFunctionDeclarations(): any[] {
    const tools = ToolRegistry.listAvailableTools();
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: 'OBJECT',
        properties: t.parameters.properties || {},
        required: t.parameters.required || [],
      },
    }));
  }

  /**
   * Single-turn call — model returns BOTH text reply AND tool calls in one response.
   * No second synthesis call needed.
   */
  public static async generateContent(params: {
    systemPrompt: string;
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    userMessage: string;
  }): Promise<GeminiResponse | null> {
    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const model = this.getModelName();
    const endpoint = `${baseUrl}/chat/completions`;

    // Append instruction for concise, grounded direct answers
    const systemWithToolInstruction = `${params.systemPrompt}

PANDUAN RESPONS:
- Jawab langsung pertanyaan pelanggan secara to-the-point, jelas, dan ramah.
- DILARANG menggunakan kata-kata penundaan (seperti "saya cekkan dulu", "mohon tunggu sebentar").
- Jika memanggil tool booking/hold meja, sertakan teks jawaban konfirmasi ringkas bersamaan.`;

    const messages: any[] = [{ role: 'system', content: systemWithToolInstruction }];

    for (const h of params.history) {
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: 'user', content: params.userMessage });

    const payload: any = {
      model,
      messages,
      tools: this.getOpenAITools(),
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1024,
    };

    const timeoutMs = this.getTimeoutMs();
    // 120-second timeout for reasoning models (e.g. Qwen 3.7 Max/Plus generating thinking tokens)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[AI] Calling ${endpoint} model=${model} (timeout=${timeoutMs / 1000}s)`);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[AI API ERROR] Status ${res.status}: ${errText}`);
        return null;
      }

      const rawText = await res.text();

      // Strip SSE suffix if present (9router appends "data: [DONE]")
      const cleanJson = rawText.replace(/\s*data: \[DONE\]\s*$/, '');
      const data = JSON.parse(cleanJson);

      const choice = data.choices?.[0];
      if (!choice) {
        console.error(`[AI API ERROR] No choices in response`);
        return null;
      }

      const message = choice.message;
      const replyText: string = message?.content || '';
      const toolCalls: Array<{ name: string; arguments: Record<string, any> }> = [];

      if (message?.tool_calls) {
        for (const tc of message.tool_calls) {
          let args: Record<string, any> = {};
          try {
            args = JSON.parse(tc.function?.arguments || '{}');
          } catch {
            args = {};
          }
          toolCalls.push({ name: tc.function?.name || '', arguments: args });
        }
      }

      console.log(`[AI] replyText="${replyText.slice(0, 80)}..." toolCalls=${toolCalls.length}`);

      return {
        replyText: replyText.trim(),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        raw: data,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error(`[AI] Request timed out (${timeoutMs / 1000}s)`);
      } else {
        console.error(`[AI API CATCH ERROR]:`, err.message);
      }
      return null;
    }
  }
}
