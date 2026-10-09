import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const widgetPath = new URL('../../components/AIChatWidget.tsx', import.meta.url);

test('AIChatWidget uses the server AI route instead of importing the old client parser', async () => {
  const source = await readFile(widgetPath, 'utf8');

  assert.doesNotMatch(source, /processAIChat/);
  assert.match(source, /fetch\("\/api\/ai\/chat"/);
  assert.match(source, /pendingConfirmation/);
});
