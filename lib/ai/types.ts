export type AIIntent =
  | 'restaurant_info'
  | 'menu_query'
  | 'availability_check'
  | 'reservation_create'
  | 'reservation_update'
  | 'reservation_cancel'
  | 'reservation_lookup'
  | 'payment_question'
  | 'general_chat'
  | 'ambiguous';

export type ModelRole = 'fast' | 'default' | 'tool' | 'reasoning' | 'classifier';
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';
export type ToolName =
  | 'get_restaurant_info'
  | 'get_menu'
  | 'search_menu'
  | 'check_availability'
  | 'create_reservation'
  | 'get_reservation'
  | 'update_reservation'
  | 'cancel_reservation';

export interface ActionButton {
  label: string;
  action: string;
  payload?: unknown;
}

export interface PendingConfirmation {
  toolName: ToolName;
  arguments: Record<string, unknown>;
  summary: string;
}

export interface AIChatRequest {
  message: string;
  history?: UIChatMessage[];
  pendingConfirmation?: PendingConfirmation | null;
  context?: {
    tenantId?: string;
    locale?: 'id';
  };
}

export interface AIChatResponse {
  reply: string;
  modelUsed: string;
  routeReason: string;
  intent: AIIntent;
  toolCalls?: ToolCallTrace[];
  pendingConfirmation?: PendingConfirmation | null;
  actionButtons?: ActionButton[];
}

export interface RouteDecision {
  intent: AIIntent;
  modelRole: ModelRole;
  model: string;
  routeReason: string;
  requiresTools: boolean;
}

export interface LLMMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: ToolName;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCallRequest {
  id: string;
  name: ToolName;
  arguments: Record<string, unknown>;
}

export interface LLMChatInput {
  model: string;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
}

export interface LLMChatOutput {
  content: string;
  toolCalls: ToolCallRequest[];
  raw?: unknown;
}

export interface LLMProvider {
  chat(input: LLMChatInput): Promise<LLMChatOutput>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  message: string;
  userSafeMessage?: string;
  errorCode?: string;
}

export interface AIToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => Promise<ToolResult>;
}

export interface ToolCallTrace {
  id: string;
  name: ToolName;
  arguments: Record<string, unknown>;
  result?: ToolResult;
  protected?: boolean;
}

export interface AITrace {
  requestId: string;
  timestamp: string;
  intent: AIIntent;
  modelUsed: string;
  routeReason: string;
  toolCalls: ToolCallTrace[];
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface UIChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  toolCall?: {
    name: string;
    params?: unknown;
    result?: unknown;
  };
  actionButtons?: ActionButton[];
}
