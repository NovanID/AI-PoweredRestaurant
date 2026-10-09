import test from 'node:test';
import assert from 'node:assert/strict';
import { executeAITool } from '../../lib/ai/tools/executor.ts';

test('executes restaurant info tool', async () => {
  const info = await executeAITool({ id: '1', name: 'get_restaurant_info', arguments: {} });
  assert.equal(info.success, true);
  assert.match(String(info.message), /Raso Minang/);
});

test('executes search menu tool', async () => {
  const menu = await executeAITool({ id: '2', name: 'search_menu', arguments: { search: 'rendang' } });
  assert.equal(menu.success, true);
  assert.match(JSON.stringify(menu.data).toLowerCase(), /rendang/);
});

test('rejects invalid required tool input', async () => {
  const invalid = await executeAITool({ id: '3', name: 'check_availability', arguments: { date: '2026-08-20' } });
  assert.equal(invalid.success, false);
  assert.equal(invalid.errorCode, 'INVALID_TOOL_INPUT');
});

test('rejects unknown tool names', async () => {
  const unknown = await executeAITool({ id: '4', name: 'unknown_tool' as any, arguments: {} });
  assert.equal(unknown.success, false);
  assert.equal(unknown.errorCode, 'UNKNOWN_TOOL');
});
