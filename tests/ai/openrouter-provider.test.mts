import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenRouterProvider, getModelNameForRole } from '../../lib/ai/providers/openrouter.ts';

function createMockFetch(body: unknown, ok = true, status = 200) {
  const calls: Array<[string, RequestInit]> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push([String(url), init || {}]);
    return {
      ok,
      status,
      async json() {
        return body;
      },
      async text() {
        return JSON.stringify(body);
      },
    } as Response;
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

test('maps fast model role to configured fast/default fallback', () => {
  assert.equal(
    getModelNameForRole('fast'),
    process.env.LLM_FAST_MODEL || process.env.LLM_DEFAULT_MODEL || 'openai/gpt-4o-mini'
  );
});

test('calls OpenRouter chat completions and parses text output', async () => {
  const mock = createMockFetch({ choices: [{ message: { content: 'Halo juga!' } }] });
  const provider = createOpenRouterProvider({ apiKey: 'test-key', fetchImpl: mock.fetchImpl });

  const output = await provider.chat({
    model: 'test/model',
    messages: [{ role: 'user', content: 'halo' }],
    tools: [],
  });

  assert.equal(mock.calls.length, 1);
  assert.match(mock.calls[0][0], /\/chat\/completions$/);
  assert.equal(mock.calls[0][1].method, 'POST');
  assert.equal(output.content, 'Halo juga!');
});

test('throws a clear error when API key is missing', async () => {
  const mock = createMockFetch({});
  const provider = createOpenRouterProvider({ apiKey: '', fetchImpl: mock.fetchImpl });

  await assert.rejects(
    () => provider.chat({ model: 'test/model', messages: [{ role: 'user', content: 'halo' }], tools: [] }),
    /OPENROUTER_API_KEY belum diset/
  );
});
