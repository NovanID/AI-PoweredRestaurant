import { TenantId, TableArea, OrderItem } from '../domain/types';

// ==========================================
// 1. CONVERSATION STATE MACHINE (FSM) TYPES
// ==========================================
export type ConversationState =
  | 'IDLE'
  | 'DISCOVERY'
  | 'RECOMMENDATION'
  | 'RESERVATION'
  | 'ORDERING'
  | 'WAITING_CONFIRMATION'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'HUMAN_HANDOFF'
  | 'FAILED';

export type IntentType =
  | 'GREETING'
  | 'MENU_QUERY'
  | 'RECOMMENDATION'
  | 'RESTAURANT_INFO'
  | 'CHECK_AVAILABILITY'
  | 'CREATE_RESERVATION'
  | 'CONFIRM_ACTION'
  | 'CANCEL_ACTION'
  | 'UPDATE_RESERVATION'
  | 'CHECK_RESERVATION'
  | 'ORDER_FOOD'
  | 'COMPLAINT'
  | 'HUMAN_HANDOFF'
  | 'GENERAL_CHAT';

// ==========================================
// 2. ACTION & CONFIRMATION PAYLOADS
// ==========================================
export type PendingActionType =
  | 'CONFIRM_RESERVATION'
  | 'CONFIRM_ORDER'
  | 'CONFIRM_CANCEL_RESERVATION'
  | 'CONFIRM_RESCHEDULE';

export interface PendingAction {
  id: string; // unique action ID
  type: PendingActionType;
  leaseToken?: string; // from TableHoldLease
  payload: Record<string, any>;
  summaryText: string;
  expiresAt: number; // Unix timestamp
}

// ==========================================
// 3. CONVERSATION MESSAGE & CONTEXT TYPES
// ==========================================
export interface AIMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  toolCall?: {
    name: string;
    params?: any;
    result?: any;
  };
  actionButtons?: Array<{
    label: string;
    action: string;
    payload?: any;
  }>;
}

export interface ConversationSession {
  sessionId: string;
  tenantId: TenantId;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  state: ConversationState;
  stateVersion: number;
  pendingAction?: PendingAction | null;
  history: AIMessage[];
  contextSummary?: string;
  metadata?: Record<string, any>;
  lastInteractionAt: number;
}

// ==========================================
// 4. TOOL REGISTRY & SAFETY TYPES
// ==========================================
export interface ToolParameterSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  properties?: Record<string, any>;
  required?: string[];
  description?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  requiresConfirmation: boolean;
  isMutating: boolean;
  tenantScoped: boolean;
  timeoutMs: number;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  data: any;
  message: string;
  errorCode?: string;
}

// ==========================================
// 5. VALIDATION & ORCHESTRATION RESULT
// ==========================================
export interface ValidationResult {
  isValid: boolean;
  reasons: string[];
  sanitizedOutput?: string;
}

export interface OrchestrationResult {
  reply: string;
  session: ConversationSession;
  toolExecuted?: ToolResult;
  validation: ValidationResult;
  actionButtons?: Array<{ label: string; action: string; payload?: any }>;
}
