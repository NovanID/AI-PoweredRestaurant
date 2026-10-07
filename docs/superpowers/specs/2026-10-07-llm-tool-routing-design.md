# Design Spec — Integrasi LLM, Structured Tool Calling, dan Dynamic Model Routing

Tanggal: 2026-10-07
Project: AI-Powered Restaurant / Raso Minang
Status: Draft untuk review

## 1. Tujuan

Mengganti AI Assistant yang saat ini berbasis rule/keyword parser menjadi subsystem AI server-side yang memakai OpenRouter, structured tool calling, dan dynamic model routing.

Target utama:

- AI menjawab dalam Bahasa Indonesia.
- AI tidak mengarang fakta operasional restoran.
- Harga, menu, availability, dan reservasi berasal dari tool terkontrol.
- Model LLM dipilih dinamis berdasarkan jenis request.
- Data tetap local/mock terlebih dahulu; belum migrasi ke Prisma/PostgreSQL.
- UI chat existing tetap dipakai sejauh mungkin.

## 2. Kondisi Saat Ini

Flow saat ini:

```text
AIChatWidget
  -> processAIChat() di client
  -> rule-based keyword parsing
  -> restaurantAITools
  -> restaurantStore
  -> mock-data/localStorage
```

Masalah utama:

- Tidak ada LLM sungguhan.
- Tool call belum structured schema.
- AI logic berjalan di client.
- Tidak ada model routing.
- Tool destructive seperti create/cancel reservation belum dipisahkan dengan confirmation gate server-side.

## 3. Keputusan Desain

### 3.1 Provider

Provider LLM yang dipakai adalah OpenRouter dengan OpenAI-compatible Chat Completions API.

Konfigurasi environment:

```env
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_URL=
OPENROUTER_APP_NAME=AI-Powered Restaurant

LLM_FAST_MODEL=
LLM_DEFAULT_MODEL=
LLM_TOOL_MODEL=
LLM_REASONING_MODEL=
LLM_CLASSIFIER_MODEL=
```

`LLM_CLASSIFIER_MODEL` disiapkan untuk fase lanjutan, tetapi routing awal tetap rule-based.

### 3.2 Persistence

Tahap ini tetap local-first.

Data operasional masih memakai:

```text
lib/mock-data.ts
lib/restaurant-store.ts
localStorage untuk sisi browser
```

Untuk AI server-side fase awal, tools akan memakai `restaurantStore` server-side. Ini cukup untuk membuktikan LLM, tool calling, dan routing. Sinkronisasi sempurna antara localStorage browser dan server store bukan target fase pertama.

Risiko yang diterima sementara:

- Data AI server bisa tidak selalu sama dengan data UI browser setelah user melakukan perubahan localStorage.
- Ini akan diselesaikan pada fase berikutnya dengan salah satu opsi:
  - client state snapshot dikirim ke `/api/ai/chat`, atau
  - migrasi ke database shared seperti PostgreSQL/Prisma.

### 3.3 Routing

Dynamic routing dibuat hybrid-ready, tetapi implementasi awal rule-based.

Intent awal:

```text
restaurant_info
menu_query
availability_check
reservation_create
reservation_update
reservation_cancel
reservation_lookup
payment_question
general_chat
ambiguous
```

Mapping awal:

| Intent | Model Role | Tools |
| --- | --- | --- |
| restaurant_info | FAST | get_restaurant_info |
| menu_query | FAST atau TOOL | get_menu/search_menu |
| availability_check | TOOL | check_availability |
| reservation_create | TOOL | check_availability, create_reservation setelah konfirmasi |
| reservation_update | TOOL | get_reservation, update_reservation setelah konfirmasi |
| reservation_cancel | TOOL | get_reservation, cancel_reservation setelah konfirmasi |
| reservation_lookup | TOOL | get_reservation |
| payment_question | DEFAULT | none atau future payment status tool |
| general_chat | DEFAULT | none |
| ambiguous | REASONING atau DEFAULT | tergantung konteks |

Classifier model belum wajib aktif. Jika routing rule-based tidak yakin, sistem akan route ke `LLM_DEFAULT_MODEL` atau `LLM_REASONING_MODEL` berdasarkan policy sederhana.

## 4. Arsitektur Target

```text
AIChatWidget
  |
  v
POST /api/ai/chat
  |
  v
AI Orchestrator
  |
  +--> Intent Classifier / Router
  |
  +--> OpenRouter Provider
  |
  +--> Tool Registry
  |
  +--> Tool Executor
  |
  v
Assistant Response
```

File target:

```text
app/api/ai/chat/route.ts

lib/ai/orchestrator.ts
lib/ai/prompts/restaurant-assistant.ts
lib/ai/providers/types.ts
lib/ai/providers/openrouter.ts
lib/ai/routing/model-router.ts
lib/ai/routing/routing-policy.ts
lib/ai/tools/definitions.ts
lib/ai/tools/registry.ts
lib/ai/tools/executor.ts
lib/ai/tools/restaurant-tools.ts
lib/ai/trace.ts
```

## 5. API Contract

### 5.1 Request

```ts
type AIChatRequest = {
  message: string;
  history?: ChatMessage[];
  pendingConfirmation?: PendingConfirmation | null;
  context?: {
    tenantId?: string;
    locale?: "id";
  };
};
```

### 5.2 Response

```ts
type AIChatResponse = {
  reply: string;
  modelUsed: string;
  routeReason: string;
  intent: string;
  toolCalls?: ToolCallTrace[];
  pendingConfirmation?: PendingConfirmation | null;
  actionButtons?: Array<{
    label: string;
    action: string;
    payload?: unknown;
  }>;
};
```

## 6. Structured Tools

Tool MVP:

```text
get_restaurant_info
get_menu
search_menu
check_availability
create_reservation
get_reservation
update_reservation
cancel_reservation
```

Setiap tool didefinisikan dengan:

```ts
type AIToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => Promise<ToolResult>;
};
```

Tool result standar:

```ts
type ToolResult = {
  success: boolean;
  data?: unknown;
  message: string;
  userSafeMessage?: string;
  errorCode?: string;
};
```

## 7. Confirmation Gate

Tool yang mengubah state tidak boleh dieksekusi langsung tanpa konfirmasi eksplisit user.

Protected tools:

```text
create_reservation
update_reservation
cancel_reservation
```

Flow:

```text
User asks to book/update/cancel
  |
  v
LLM extracts intent and required data
  |
  v
System runs read-only tools if needed
  |
  v
Assistant asks confirmation
  |
  v
User confirms
  |
  v
Protected tool executes
```

Pending confirmation disimpan di conversation state client dan dikirim ulang ke `/api/ai/chat` pada message berikutnya.

## 8. Prompt Guardrails

System prompt harus mengatur:

- Jawab dalam Bahasa Indonesia.
- Jangan mengarang harga, menu, stok, availability, status reservasi, atau kebijakan.
- Gunakan tool untuk fakta operasional.
- Jika data kurang, minta klarifikasi.
- Jangan membuat/mengubah/membatalkan reservasi tanpa konfirmasi eksplisit.
- Jangan menampilkan data sensitif secara berlebihan.
- Jika tool gagal, jelaskan kegagalan dengan aman dan tawarkan langkah berikutnya.

## 9. OpenRouter Provider

Provider OpenRouter bertanggung jawab untuk:

- membangun payload chat completion,
- mengirim model dinamis dari router,
- mengirim tool schemas jika diperlukan,
- membaca `tool_calls` dari response,
- mengembalikan output terstandardisasi ke orchestrator.

Header tambahan yang disiapkan:

```text
Authorization: Bearer <OPENROUTER_API_KEY>
HTTP-Referer: OPENROUTER_APP_URL
X-Title: OPENROUTER_APP_NAME
```

## 10. Orchestrator Flow

```text
1. Terima message + history + pendingConfirmation.
2. Jika pendingConfirmation ada dan user mengonfirmasi, execute protected tool.
3. Jika tidak ada pending confirmation:
   a. classify intent dengan rule-based classifier.
   b. route model berdasarkan intent.
   c. call OpenRouter dengan prompt dan tool schemas.
   d. jika LLM meminta tool, validate dan execute tool.
   e. jika tool protected, jangan execute; return confirmation prompt.
   f. jika tool read-only, execute lalu minta final answer ke LLM atau format langsung.
4. Return reply + modelUsed + routeReason + toolCalls.
```

## 11. UI Changes

`components/AIChatWidget.tsx` diubah dari direct import:

```ts
processAIChat(...)
```

menjadi:

```ts
fetch("/api/ai/chat", ...)
```

UI tetap mempertahankan:

- chat messages,
- typing indicator,
- tool call indicator,
- action buttons,
- pending confirmation.

Tambahan metadata yang boleh ditampilkan kecil di UI:

- model used,
- tool name,
- route reason untuk debug/demo.

## 12. Error Handling

Kasus yang harus ditangani:

- `OPENROUTER_API_KEY` belum diset.
- OpenRouter timeout/error.
- Model tidak mendukung tools.
- Tool input invalid.
- Tool execution gagal.
- Protected tool dipanggil tanpa konfirmasi.

Fallback awal:

- Return jawaban sopan bahwa AI sedang bermasalah.
- Untuk demo lokal, bisa fallback ke rule-based `processAIChat` hanya jika perlu, tetapi default target adalah server-side AI route.

## 13. Observability Minimum

Trace per request:

```ts
type AITrace = {
  requestId: string;
  timestamp: string;
  intent: string;
  modelUsed: string;
  routeReason: string;
  toolCalls: ToolCallTrace[];
  latencyMs: number;
  success: boolean;
  error?: string;
};
```

Untuk tahap local, trace cukup `console.log` server-side dan dikembalikan sebagian ke response untuk debugging.

## 14. Testing Scope

Manual test utama:

1. FAQ restoran:
   - "Alamat restoran di mana?"
   - expected: `get_restaurant_info`.

2. Menu:
   - "Berapa harga rendang?"
   - expected: `get_menu` atau `search_menu`.

3. Availability:
   - "Ada meja untuk 4 orang besok jam 19.00?"
   - expected: `check_availability`.

4. Create reservation:
   - user minta booking,
   - system minta konfirmasi,
   - user konfirmasi,
   - `create_reservation` berjalan.

5. Update reservation:
   - user minta ubah jadwal,
   - system minta konfirmasi,
   - `update_reservation` berjalan.

6. Cancel reservation:
   - user minta batal,
   - system minta konfirmasi,
   - `cancel_reservation` berjalan.

7. Error path:
   - env key kosong,
   - expected response aman, bukan crash UI.

## 15. Out of Scope Fase Ini

- Migrasi Prisma/PostgreSQL.
- NestJS backend.
- Auth admin.
- Streaming response.
- Long-term memory.
- Multi-tenant production isolation.
- Payment-specific AI tools selain pertanyaan umum.
- Full observability database.

## 16. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Server store tidak sinkron dengan localStorage browser | AI melihat data berbeda dari UI | diterima untuk fase local; lanjutkan dengan snapshot atau DB nanti |
| Model OpenRouter tidak support tool calling | tool calls tidak muncul | provider adapter harus handle fallback text/JSON mode |
| AI menjalankan mutation tanpa izin | reservasi berubah tanpa persetujuan | confirmation gate wajib |
| Biaya model membengkak | boros API usage | rule-based routing awal |
| Hallucination | jawaban operasional salah | prompt guardrails + tools sebagai source of truth |
| Env belum diset | API gagal | error handling eksplisit |

## 17. Urutan Implementasi yang Disarankan

1. Tambah type AI shared.
2. Tambah OpenRouter provider.
3. Tambah model router rule-based.
4. Tambah tool definitions, registry, executor.
5. Tambah restaurant tools wrapper dari existing `restaurantStore`.
6. Tambah orchestrator.
7. Tambah `/api/ai/chat` route.
8. Update `AIChatWidget` memakai API route.
9. Tambah trace/debug metadata.
10. Manual test skenario utama.

## 18. Acceptance Criteria

Fase ini dianggap selesai jika:

- Chat UI memanggil `/api/ai/chat`, bukan `processAIChat` langsung.
- OpenRouter dipakai melalui server-side provider.
- Router memilih model berdasarkan intent dan mengembalikan `modelUsed`.
- Tool read-only bisa dipanggil secara structured.
- Tool protected membutuhkan konfirmasi sebelum mutation.
- Jawaban menu/reservasi/availability berasal dari tool result.
- Jika OpenRouter/env error, UI tetap mendapat response error yang aman.
- Project tetap berjalan local-first tanpa migrasi database.
