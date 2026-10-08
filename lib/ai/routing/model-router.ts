import type { AIIntent, ModelRole, RouteDecision } from '../types.ts';

function normalize(message: string): string {
  return message.toLowerCase().trim();
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasReservationCode(text: string): boolean {
  return /rm-[a-z0-9]{4}/i.test(text);
}

function hasGuestOrTimeSignal(text: string): boolean {
  return (
    /\d+\s*(orang|tamu|pax|org)/i.test(text) ||
    /\d{1,2}[:.]\d{2}/.test(text) ||
    hasAny(text, ['jam', 'besok', 'hari ini', 'malam', 'siang', 'sore'])
  );
}

export function classifyIntent(message: string): AIIntent {
  const text = normalize(message);

  if (!text) return 'general_chat';

  const hasCode = hasReservationCode(text);
  const updateKeywords = ['ubah', 'ganti', 'geser', 'pindah', 'reschedule'];
  const cancelKeywords = ['batal', 'batalkan', 'cancel'];
  const lookupKeywords = ['cek', 'status', 'lihat', 'kode'];

  if (hasCode && hasAny(text, cancelKeywords)) return 'reservation_cancel';
  if (hasCode && hasAny(text, updateKeywords)) return 'reservation_update';
  if (hasCode && hasAny(text, lookupKeywords)) return 'reservation_lookup';

  if (hasAny(text, ['bayar', 'pembayaran', 'deposit', 'midtrans', 'qris', 'gopay'])) {
    return 'payment_question';
  }

  if (hasAny(text, ['alamat', 'lokasi', 'jam buka', 'buka jam', 'tutup', 'kontak', 'telepon', 'kebijakan', 'profil'])) {
    return 'restaurant_info';
  }

  if (hasAny(text, ['ada meja', 'meja kosong', 'tersedia', 'kosong']) && hasGuestOrTimeSignal(text)) {
    return 'availability_check';
  }

  if (
    hasAny(text, ['reservasi', 'booking', 'pesan meja', 'mau pesan']) &&
    !hasAny(text, updateKeywords) &&
    !hasAny(text, cancelKeywords)
  ) {
    return 'reservation_create';
  }

  if (hasAny(text, ['menu', 'harga', 'rendang', 'ayam pop', 'dendeng', 'gulai', 'sambal', 'minuman'])) {
    return 'menu_query';
  }

  if (hasAny(text, ['bantu', 'rekomendasi', 'saran']) && hasAny(text, ['makan', 'keluarga', 'acara'])) {
    return 'ambiguous';
  }

  return 'general_chat';
}

function modelRoleForIntent(intent: AIIntent): ModelRole {
  if (intent === 'restaurant_info' || intent === 'menu_query') return 'fast';
  if (
    intent === 'availability_check' ||
    intent === 'reservation_create' ||
    intent === 'reservation_update' ||
    intent === 'reservation_cancel' ||
    intent === 'reservation_lookup'
  ) {
    return 'tool';
  }
  if (intent === 'ambiguous') return 'reasoning';
  return 'default';
}

function placeholderModelForRole(role: ModelRole): string {
  const env = process.env;
  if (role === 'fast') return env.LLM_FAST_MODEL || env.LLM_DEFAULT_MODEL || 'openai/gpt-4o-mini';
  if (role === 'tool') return env.LLM_TOOL_MODEL || env.LLM_DEFAULT_MODEL || 'openai/gpt-4o-mini';
  if (role === 'reasoning') return env.LLM_REASONING_MODEL || env.LLM_DEFAULT_MODEL || 'openai/gpt-4o';
  if (role === 'classifier') return env.LLM_CLASSIFIER_MODEL || env.LLM_FAST_MODEL || 'openai/gpt-4o-mini';
  return env.LLM_DEFAULT_MODEL || 'openai/gpt-4o-mini';
}

export function routeModel(message: string): RouteDecision {
  const intent = classifyIntent(message);
  const modelRole = modelRoleForIntent(intent);
  return {
    intent,
    modelRole,
    model: placeholderModelForRole(modelRole),
    routeReason: `rule:${intent}`,
    requiresTools: modelRole === 'tool' || intent === 'restaurant_info' || intent === 'menu_query',
  };
}
