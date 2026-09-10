import { TenantId } from '../domain/types';

export interface TraceSpan {
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'OK' | 'ERROR';
  metadata?: Record<string, any>;
}

export interface TraceRecord {
  traceId: string;
  tenantId: TenantId;
  conversationId: string;
  startTime: number;
  endTime?: number;
  totalDurationMs?: number;
  spans: TraceSpan[];
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class ObservabilityManager {
  private static activeTraces: Map<string, TraceRecord> = new Map();

  public static startTrace(params: {
    traceId?: string;
    tenantId: TenantId;
    conversationId: string;
  }): TraceRecord {
    const traceId = params.traceId || `trc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record: TraceRecord = {
      traceId,
      tenantId: params.tenantId,
      conversationId: params.conversationId,
      startTime: Date.now(),
      spans: [],
    };
    this.activeTraces.set(traceId, record);
    return record;
  }

  public static startSpan(traceId: string, spanName: string, metadata?: Record<string, any>): () => void {
    const trace = this.activeTraces.get(traceId);
    const span: TraceSpan = {
      name: spanName,
      startTime: Date.now(),
      status: 'OK',
      metadata,
    };
    if (trace) {
      trace.spans.push(span);
    }

    return () => {
      span.endTime = Date.now();
      span.durationMs = span.endTime - span.startTime;
    };
  }

  public static endTrace(traceId: string, tokenUsage?: { promptTokens: number; completionTokens: number }): TraceRecord | undefined {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return undefined;

    trace.endTime = Date.now();
    trace.totalDurationMs = trace.endTime - trace.startTime;
    if (tokenUsage) {
      trace.tokenUsage = {
        ...tokenUsage,
        totalTokens: tokenUsage.promptTokens + tokenUsage.completionTokens,
      };
    }

    this.activeTraces.delete(traceId);
    return trace;
  }
}
