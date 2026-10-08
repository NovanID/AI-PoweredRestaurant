import type { AITrace } from './types.ts';

export function createAITrace(input: Omit<AITrace, 'requestId' | 'timestamp'>): AITrace {
  return {
    requestId: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...input,
  };
}
