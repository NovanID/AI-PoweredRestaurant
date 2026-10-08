import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent, routeModel } from '../../lib/ai/routing/model-router.ts';

test('classifies restaurant assistant intents from Indonesian messages', () => {
  assert.equal(classifyIntent('Alamat restoran di mana?'), 'restaurant_info');
  assert.equal(classifyIntent('Berapa harga rendang?'), 'menu_query');
  assert.equal(classifyIntent('Ada meja untuk 4 orang besok jam 19.00?'), 'availability_check');
  assert.equal(classifyIntent('Saya mau booking meja besok malam'), 'reservation_create');
  assert.equal(classifyIntent('Ubah reservasi RM-ABCD jadi jam 19.00'), 'reservation_update');
  assert.equal(classifyIntent('Batalkan reservasi RM-ABCD'), 'reservation_cancel');
  assert.equal(classifyIntent('Cek status reservasi RM-ABCD'), 'reservation_lookup');
});

test('routes simple menu questions to the fast model and reservations to the tool model', () => {
  assert.equal(routeModel('Berapa harga rendang?').modelRole, 'fast');
  assert.equal(routeModel('Saya mau booking meja besok malam').modelRole, 'tool');
});
