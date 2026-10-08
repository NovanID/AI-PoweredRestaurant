import type { AIToolDefinition, LLMToolDefinition, ToolName } from '../types.ts';
import { RESTAURANT_TOOL_DEFINITIONS } from './definitions.ts';
import { restaurantTools } from './restaurant-tools.ts';

export const restaurantToolRegistry: Record<ToolName, AIToolDefinition> = restaurantTools.reduce(
  (registry, tool) => {
    registry[tool.name] = tool;
    return registry;
  },
  {} as Record<ToolName, AIToolDefinition>
);

export function getAITool(name: string): AIToolDefinition | undefined {
  return restaurantToolRegistry[name as ToolName];
}

export function getLLMToolDefinitions(): LLMToolDefinition[] {
  return RESTAURANT_TOOL_DEFINITIONS;
}
