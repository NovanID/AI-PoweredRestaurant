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
    return process.env.AI_BASE_URL || 'http://localhost:20128/v1';
  }

  private static getApiKey(): string {
    return process.env.AI_API_KEY || 'sk-placeholder';
  }

  private static getModelName(): string {
    return process.env.AI_MODEL || 'qwen-plus';
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
   * Turn 1 — Call OpenAI-compatible API for reasoning & tool calls
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

    const messages: any[] = [{ role: 'system', content: params.systemPrompt }];

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

    try {
      console.log(`[AI DEBUG] Calling: ${endpoint} with model: ${model}`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      console.log(`[AI DEBUG] Response status: ${res.status} ${res.statusText}`);
      console.log(`[AI DEBUG] Response headers:`, Object.fromEntries(res.headers.entries()));

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[AI API ERROR] Status ${res.status}: ${errText}`);
        return null;
      }

      const rawText = await res.text();
      console.log(`[AI DEBUG] Raw response (first 500 chars):`, rawText.substring(0, 500));
      console.log(`[AI DEBUG] Raw response (last 200 chars):`, rawText.substring(rawText.length - 200));
      
      // Strip SSE suffix if present (9router appends "data: [DONE]" possibly without newline separator)
      const cleanJson = rawText.replace(/\s*data: \[DONE\]\s*$/, '');
      console.log(`[AI DEBUG] Cleaned JSON (last 100 chars):`, cleanJson.substring(cleanJson.length - 100));
      
      const data = JSON.parse(cleanJson);
      console.log(`[AI DEBUG] Parsed response:`, JSON.stringify(data, null, 2).substring(0, 800));
      
      const choice = data.choices?.[0];
      if (!choice) {
        console.error(`[AI API ERROR] No choices in response`);
        return null;
      }

      const message = choice.message;
      const replyText: string = message?.content || '';
      const toolCalls: Array<{ name: string; arguments: Record<string, any> }> = [];

      if (message?.tool_calls) {
        console.log(`[AI DEBUG] Tool calls found:`, message.tool_calls);
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

      console.log(`[AI DEBUG] Final replyText:`, replyText);
      console.log(`[AI DEBUG] Final toolCalls:`, toolCalls);

      return {
        replyText: replyText.trim(),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        raw: data,
      };
    } catch (err: any) {
      console.error(`[AI API CATCH ERROR]:`, err);
      console.error(`[AI API CATCH ERROR] Stack:`, err.stack);
      return null;
    }
  }

  /**
   * Turn 2 — Feed tool result back to model to synthesize natural language response
   */
  public static async synthesizeToolResponse(params: {
    systemPrompt: string;
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    userMessage: string;
    toolCall: { name: string; arguments: Record<string, any> };
    toolResult: any;
  }): Promise<string | null> {
    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const model = this.getModelName();
    const endpoint = `${baseUrl}/chat/completions`;

    const synthesisPrompt = `${params.systemPrompt}\n\nATURAN RESPON CEPAT & SINGKAT:\n1. TULIS DALAM MAKSIMAL 2 SAMPAI 3 KALIMAT RINGKAS SAJA.\n2. Langsung sebutkan nama menu & harga (Rp) atau konfirmasi meja/take away tanpa bertele-tele.\n3. Jangan tulis paragraf panjang!`;

    const messages: any[] = [
      { role: 'system', content: synthesisPrompt },
    ];

    for (const h of params.history) {
      messages.push({ role: h.role, content: h.content });
    }

    messages.push({ role: 'user', content: params.userMessage });
    messages.push({
      role: 'user',
      content: `[DATA DARI SISTEM UNTUK AKSI ${params.toolCall.name}]:\n${JSON.stringify(params.toolResult, null, 2)}`,
    });

    const payload: any = {
      model,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[AI Synthesis Warning] Status ${res.status}: ${errText}`);
        return null;
      }

      const rawText = await res.text();
      const cleanJson = rawText.replace(/\s*data: \[DONE\]\s*$/, '');
      const data = JSON.parse(cleanJson);
      const text = data.choices?.[0]?.message?.content;
      return text ? text.trim() : null;
    } catch (err: any) {
      console.warn('[AI Synthesis Catch Error]:', err.message);
      return null;
    }
  }
}
