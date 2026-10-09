import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../../app/api/ai/chat/route.ts';

test('AI chat route returns safe 400 response for invalid message body', async () => {
  const req = new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 123 }),
  });

  const res = await POST(req as any);
  const data = await res.json();

  assert.equal(res.status, 400);
  assert.match(data.reply, /Format pesan tidak valid/);
  assert.ok(data.intent);
  assert.ok(data.modelUsed);
});

test('AI chat route returns safe response when body is valid but AI provider is not configured', async () => {
  const req = new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Halo' }),
  });

  const res = await POST(req as any);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.match(data.reply, /AI Assistant sedang mengalami kendala/);
  assert.ok(data.intent);
  assert.ok(data.modelUsed);
});
