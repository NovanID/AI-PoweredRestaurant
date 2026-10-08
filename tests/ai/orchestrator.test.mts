import test from 'node:test';
import assert from 'node:assert/strict';
import { processAIChatServer } from '../../lib/ai/orchestrator.ts';
import type { LLMProvider, ToolName } from '../../lib/ai/types.ts';

function fakeProviderWithToolCall(name: ToolName, args: Record<string, unknown>): LLMProvider {
  return {
    async chat() {
      return {
        content: '',
        toolCalls: [{ id: `call-${name}`, name, arguments: args }],
        raw: {},
      };
    },
  };
}

test('executes read-only tool calls and returns tool-grounded reply', async () => {
  const readOnlyProvider = fakeProviderWithToolCall('get_restaurant_info', {});
  const res = await processAIChatServer({ message: 'Alamat restoran di mana?' }, { provider: readOnlyProvider });

  assert.equal(res.toolCalls?.[0].name, 'get_restaurant_info');
  assert.match(res.reply, /Raso Minang/);
  assert.ok(res.modelUsed);
});

test('returns pending confirmation for protected tool calls without executing them', async () => {
  const protectedProvider = fakeProviderWithToolCall('create_reservation', {
    customerName: 'Budi',
    customerPhone: '081234567890',
    date: '2026-08-21',
    time: '19:00',
    guestCount: 4,
  });

  const pending = await processAIChatServer({ message: 'Booking atas nama Budi' }, { provider: protectedProvider });

  assert.equal(pending.pendingConfirmation?.toolName, 'create_reservation');
  assert.deepEqual(pending.toolCalls, []);
  assert.match(pending.reply.toLowerCase(), /konfirmasi/);
});

test('executes pending protected tool after explicit confirmation', async () => {
  const protectedProvider = fakeProviderWithToolCall('create_reservation', {
    customerName: 'Budi',
    customerPhone: '081234567890',
    date: '2026-08-21',
    time: '19:00',
    guestCount: 4,
  });

  const pending = await processAIChatServer({ message: 'Booking atas nama Budi' }, { provider: protectedProvider });
  const confirmed = await processAIChatServer(
    { message: 'Ya, konfirmasi', pendingConfirmation: pending.pendingConfirmation },
    { provider: protectedProvider }
  );

  assert.equal(confirmed.toolCalls?.[0].name, 'create_reservation');
  assert.match(confirmed.reply, /Reservasi/);
});

test('formats menu tool results with item names and prices, not only counts', async () => {
  const menuProvider = fakeProviderWithToolCall('get_menu', { search: 'rendang' });

  const res = await processAIChatServer({ message: 'Berapa harga rendang?' }, { provider: menuProvider });

  assert.equal(res.toolCalls?.[0].name, 'get_menu');
  assert.match(res.reply, /Rendang Daging Sapi/);
  assert.match(res.reply, /Rp35\.000/);
  assert.doesNotMatch(res.reply, /^Ditemukan \d+ menu yang cocok\.?$/);
});

test('grounds menu facts through tools even when provider returns plain text', async () => {
  const plainTextProvider: LLMProvider = {
    async chat() {
      return { content: 'Rendang gratis hari ini.', toolCalls: [], raw: {} };
    },
  };

  const res = await processAIChatServer({ message: 'Berapa harga rendang?' }, { provider: plainTextProvider });

  assert.equal(res.toolCalls?.[0].name, 'search_menu');
  assert.doesNotMatch(res.reply.toLowerCase(), /gratis/);
  assert.match(res.reply.toLowerCase(), /rendang/);
});

test('returns safe response when provider fails', async () => {
  const missingKeyProvider: LLMProvider = {
    async chat() {
      throw new Error('OPENROUTER_API_KEY belum diset');
    },
  };

  const error = await processAIChatServer({ message: 'Halo' }, { provider: missingKeyProvider });
  assert.match(error.reply, /AI Assistant sedang mengalami kendala/);
});
