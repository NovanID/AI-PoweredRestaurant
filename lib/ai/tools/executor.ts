import type { ToolCallRequest, ToolName, ToolResult } from '../types.ts';
import { getAITool } from './registry.ts';

const REQUIRED_FIELDS: Partial<Record<ToolName, string[]>> = {
  search_menu: ['search'],
  check_availability: ['date', 'time', 'guestCount'],
  create_reservation: ['customerName', 'customerPhone', 'date', 'time', 'guestCount'],
  get_reservation: ['code'],
  update_reservation: ['code'],
  cancel_reservation: ['code'],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasRequiredFields(name: ToolName, args: Record<string, unknown>): boolean {
  const required = REQUIRED_FIELDS[name] || [];
  return required.every((field) => {
    const value = args[field];
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    return value !== undefined && value !== null;
  });
}

export async function executeAITool(call: ToolCallRequest): Promise<ToolResult> {
  const tool = getAITool(call.name);
  if (!tool) {
    return { success: false, message: 'Tool tidak dikenal.', errorCode: 'UNKNOWN_TOOL' };
  }

  const args = call.arguments;
  if (!isPlainObject(args) || !hasRequiredFields(call.name, args)) {
    return {
      success: false,
      message: 'Input tool tidak lengkap atau tidak valid.',
      errorCode: 'INVALID_TOOL_INPUT',
    };
  }

  try {
    return await tool.execute(args);
  } catch (error) {
    console.error('[AI Tool Executor] Tool execution failed:', error);
    return { success: false, message: 'Tool gagal dijalankan.', errorCode: 'TOOL_EXECUTION_ERROR' };
  }
}
