import type { LLMChatInput, LLMChatOutput, LLMProvider, ModelRole, ToolCallRequest, ToolName } from '../types.ts';

export interface OpenRouterProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  appUrl?: string;
  appName?: string;
  fetchImpl?: typeof fetch;
}

export function getModelNameForRole(role: ModelRole): string {
  if (role === 'fast') return process.env.LLM_FAST_MODEL || process.env.LLM_DEFAULT_MODEL || 'openai/gpt-4o-mini';
  if (role === 'tool') return process.env.LLM_TOOL_MODEL || process.env.LLM_DEFAULT_MODEL || 'openai/gpt-4o-mini';
  if (role === 'reasoning') return process.env.LLM_REASONING_MODEL || process.env.LLM_DEFAULT_MODEL || 'openai/gpt-4o';
  if (role === 'classifier') return process.env.LLM_CLASSIFIER_MODEL || process.env.LLM_FAST_MODEL || 'openai/gpt-4o-mini';
  return process.env.LLM_DEFAULT_MODEL || 'openai/gpt-4o-mini';
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseToolCalls(rawToolCalls: unknown): ToolCallRequest[] {
  if (!Array.isArray(rawToolCalls)) return [];
  return rawToolCalls
    .map((toolCall, index): ToolCallRequest | null => {
      if (!toolCall || typeof toolCall !== 'object') return null;
      const item = toolCall as Record<string, any>;
      const fn = item.function;
      if (!fn || typeof fn.name !== 'string') return null;
      return {
        id: typeof item.id === 'string' ? item.id : `tool-${index}`,
        name: fn.name as ToolName,
        arguments: parseToolArguments(fn.arguments),
      };
    })
    .filter((item): item is ToolCallRequest => Boolean(item));
}

export function createOpenRouterProvider(options: OpenRouterProviderOptions = {}): LLMProvider {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
  const baseUrl = options.baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const appUrl = options.appUrl ?? process.env.OPENROUTER_APP_URL;
  const appName = options.appName ?? process.env.OPENROUTER_APP_NAME ?? 'AI-Powered Restaurant';
  const fetchImpl = options.fetchImpl || fetch;

  return {
    async chat(input: LLMChatInput): Promise<LLMChatOutput> {
      if (!apiKey.trim()) {
        throw new Error('OPENROUTER_API_KEY belum diset');
      }

      const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (appUrl) headers['HTTP-Referer'] = appUrl;
      if (appName) headers['X-Title'] = appName;

      const body: Record<string, unknown> = {
        model: input.model,
        messages: input.messages.map((message) => ({
          role: message.role,
          content: message.content,
          ...(message.name ? { name: message.name } : {}),
          ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
        })),
      };

      if (input.tools && input.tools.length > 0) {
        body.tools = input.tools;
        body.tool_choice = 'auto';
      }

      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(async () => ({ error: await response.text() }));
      if (!response.ok) {
        const message = data?.error?.message || data?.message || `OpenRouter request failed (${response.status})`;
        throw new Error(message);
      }

      const message = data?.choices?.[0]?.message || {};
      return {
        content: typeof message.content === 'string' ? message.content : '',
        toolCalls: parseToolCalls(message.tool_calls),
        raw: data,
      };
    },
  };
}
