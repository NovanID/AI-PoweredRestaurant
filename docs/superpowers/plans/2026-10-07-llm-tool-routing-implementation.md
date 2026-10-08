# LLM Tool Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first OpenRouter-backed AI assistant subsystem with structured tool calling, rule-based model routing, server-side orchestration, and existing chat UI integration.

**Architecture:** Add a focused `lib/ai/*` subsystem behind `POST /api/ai/chat`. The orchestrator routes each message, calls an OpenRouter-compatible provider, executes structured restaurant tools, and enforces confirmation gates for state-changing tools. The existing `AIChatWidget` stays visually intact but sends messages to the server route instead of importing the old client-side rule parser.

**Tech Stack:** Next.js App Router route handlers, TypeScript, React client component, OpenRouter Chat Completions API, Vitest for unit tests, existing `restaurantStore`/mock data for local persistence.

**Spec:** `docs/superpowers/specs/2026-10-07-llm-tool-routing-design.md`

## Global Constraints

- Provider LLM: OpenRouter using OpenAI-compatible Chat Completions API.
- Data remains local/mock-first; do not migrate to Prisma/PostgreSQL in this phase.
- UI chat remains based on the existing `components/AIChatWidget.tsx` experience.
- AI must answer in Bahasa Indonesia.
- AI must not invent restaurant facts; menu, prices, availability, and reservations come from tools.
- Initial routing is rule-based; classifier model is interface-ready but not required.
- Protected tools require explicit user confirmation before mutation: `create_reservation`, `update_reservation`, `cancel_reservation`.
- Out of scope: NestJS, auth admin, streaming response, long-term memory, full DB observability.

## Review Focus

- Missing `OPENROUTER_API_KEY`: API returns safe Indonesian error response and UI does not crash. Covered in Task 4.
- Ambiguous booking request without enough details: orchestrator asks for clarification instead of inventing date/time/phone. Covered in Task 4.
- Protected tool call from model before user confirmation: orchestrator returns `pendingConfirmation` and does not mutate store. Covered in Task 4.
- Invalid tool input shape: executor rejects with safe `ToolResult` instead of throwing uncaught exceptions. Covered in Task 2.
- OpenRouter response without valid `tool_calls`: provider/orchestrator falls back to text answer or safe error. Covered in Task 3 and Task 4.

---

## File Structure

- Create `lib/ai/types.ts` — shared AI request/response, provider, routing, tool, trace, and confirmation types.
- Create `lib/ai/prompts/restaurant-assistant.ts` — system prompt and guardrail text.
- Create `lib/ai/routing/model-router.ts` — rule-based intent classifier and model-role selection.
- Create `lib/ai/tools/definitions.ts` — JSON-schema-like tool definitions and protected tool list.
- Create `lib/ai/tools/restaurant-tools.ts` — wrappers around existing `restaurantStore` business logic.
- Create `lib/ai/tools/registry.ts` — registry map and exported tool list.
- Create `lib/ai/tools/executor.ts` — tool lookup, input validation, execution, and safe errors.
- Create `lib/ai/providers/openrouter.ts` — OpenRouter provider implementation.
- Create `lib/ai/orchestrator.ts` — routing, provider call, tool execution, confirmation gate, final response.
- Create `lib/ai/trace.ts` — request trace helper.
- Create `app/api/ai/chat/route.ts` — server entry point.
- Modify `components/AIChatWidget.tsx` — replace `processAIChat` import/call with API request.
- Modify `package.json` — add test/typecheck scripts and Vitest dev dependency.
- Create `tests/ai/*.test.ts` — unit tests for routing, tools, provider, and orchestrator.

---

### Task 1: Test Harness, AI Types, Prompt, and Rule-Based Router

**Files:**
- Modify: `package.json`
- Create: `lib/ai/types.ts`
- Create: `lib/ai/prompts/restaurant-assistant.ts`
- Create: `lib/ai/routing/model-router.ts`
- Test: `tests/ai/model-router.test.ts`

**Interfaces:**
- Produces: `AIChatRequest`, `AIChatResponse`, `LLMProvider`, `LLMChatInput`, `LLMChatOutput`, `ToolCallRequest`, `ToolCallTrace`, `PendingConfirmation`, `RouteDecision`, `classifyIntent(message: string): AIIntent`, `routeModel(message: string): RouteDecision`, `RESTAURANT_ASSISTANT_SYSTEM_PROMPT`.
- Consumes: none.

- [ ] **Step 1: Add Vitest scripts and dependency to `package.json`**

Set scripts exactly:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

Add `"vitest": "latest"` to `devDependencies`.

- [ ] **Step 2: Write failing router tests in `tests/ai/model-router.test.ts`**

Test cases:

```ts
expect(classifyIntent("Alamat restoran di mana?")).toBe("restaurant_info");
expect(classifyIntent("Berapa harga rendang?")).toBe("menu_query");
expect(classifyIntent("Ada meja untuk 4 orang besok jam 19.00?")).toBe("availability_check");
expect(classifyIntent("Saya mau booking meja besok malam")).toBe("reservation_create");
expect(classifyIntent("Ubah reservasi RM-ABCD jadi jam 19.00")).toBe("reservation_update");
expect(classifyIntent("Batalkan reservasi RM-ABCD")).toBe("reservation_cancel");
expect(classifyIntent("Cek status reservasi RM-ABCD")).toBe("reservation_lookup");
expect(routeModel("Berapa harga rendang?").modelRole).toBe("fast");
expect(routeModel("Saya mau booking meja besok malam").modelRole).toBe("tool");
```

- [ ] **Step 3: Run router test and verify it fails**

Run: `npm test -- tests/ai/model-router.test.ts`

Expected: FAIL because `lib/ai/routing/model-router.ts` does not exist.

- [ ] **Step 4: Implement `lib/ai/types.ts`**

Define these exported types exactly:

```ts
export type AIIntent = "restaurant_info" | "menu_query" | "availability_check" | "reservation_create" | "reservation_update" | "reservation_cancel" | "reservation_lookup" | "payment_question" | "general_chat" | "ambiguous";
export type ModelRole = "fast" | "default" | "tool" | "reasoning" | "classifier";
export type ChatRole = "system" | "user" | "assistant" | "tool";
export type ToolName = "get_restaurant_info" | "get_menu" | "search_menu" | "check_availability" | "create_reservation" | "get_reservation" | "update_reservation" | "cancel_reservation";
```

Also export interfaces: `AIChatRequest`, `AIChatResponse`, `RouteDecision`, `LLMMessage`, `LLMToolDefinition`, `ToolCallRequest`, `LLMChatInput`, `LLMChatOutput`, `LLMProvider`, `ToolResult`, `AIToolDefinition`, `ToolCallTrace`, `PendingConfirmation`, `ActionButton`, `AITrace`.

Use the field names from the spec: `reply`, `modelUsed`, `routeReason`, `intent`, `toolCalls`, `pendingConfirmation`, `actionButtons`.

- [ ] **Step 5: Implement `lib/ai/prompts/restaurant-assistant.ts`**

Export `RESTAURANT_ASSISTANT_SYSTEM_PROMPT: string` containing the spec guardrails:

- Bahasa Indonesia.
- Do not invent menu/prices/availability/reservation facts.
- Use tools for operational facts.
- Ask clarification when data is incomplete.
- Do not create/update/cancel reservations without explicit confirmation.
- Do not overexpose sensitive data.

- [ ] **Step 6: Implement `classifyIntent(message: string): AIIntent` and `routeModel(message: string): RouteDecision` in `lib/ai/routing/model-router.ts`**

Rules:

- restaurant info keywords: `alamat`, `lokasi`, `jam buka`, `buka jam`, `tutup`, `kontak`, `telepon`, `kebijakan`, `profil`.
- menu keywords: `menu`, `harga`, `rendang`, `ayam pop`, `dendeng`, `gulai`, `sambal`, `minuman`.
- availability keywords: `ada meja`, `meja kosong`, `tersedia`, `kosong` plus guest/time wording.
- create keywords: `reservasi`, `booking`, `pesan meja`, `mau pesan` without update/cancel words.
- update keywords: `ubah`, `ganti`, `geser`, `pindah`, `reschedule` with `rm-` reservation code.
- cancel keywords: `batal`, `batalkan`, `cancel` with `rm-` or `reservasi`.
- lookup keywords: `cek`, `status`, `lihat`, `kode` with `rm-`.
- payment keywords: `bayar`, `pembayaran`, `deposit`, `midtrans`, `qris`, `gopay`.

Map model roles:

- `restaurant_info`, `menu_query` -> `fast`.
- `availability_check`, `reservation_create`, `reservation_update`, `reservation_cancel`, `reservation_lookup` -> `tool`.
- `payment_question`, `general_chat` -> `default`.
- `ambiguous` -> `reasoning`.

- [ ] **Step 7: Run router test and verify it passes**

Run: `npm test -- tests/ai/model-router.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add package.json lib/ai/types.ts lib/ai/prompts/restaurant-assistant.ts lib/ai/routing/model-router.ts tests/ai/model-router.test.ts
git commit -m "feat: add AI routing foundation"
```

---

### Task 2: Structured Tool Registry and Restaurant Tool Executor

**Files:**
- Create: `lib/ai/tools/definitions.ts`
- Create: `lib/ai/tools/restaurant-tools.ts`
- Create: `lib/ai/tools/registry.ts`
- Create: `lib/ai/tools/executor.ts`
- Test: `tests/ai/tool-executor.test.ts`

**Interfaces:**
- Consumes: `AIToolDefinition`, `ToolName`, `ToolResult`, `ToolCallRequest` from `lib/ai/types.ts`.
- Produces: `PROTECTED_TOOL_NAMES`, `RESTAURANT_TOOL_DEFINITIONS`, `restaurantToolRegistry`, `executeAITool(call: ToolCallRequest): Promise<ToolResult>`.

- [ ] **Step 1: Write failing tool executor tests in `tests/ai/tool-executor.test.ts`**

Test cases:

```ts
const info = await executeAITool({ id: "1", name: "get_restaurant_info", arguments: {} });
expect(info.success).toBe(true);
expect(String(info.message)).toContain("Raso Minang");

const menu = await executeAITool({ id: "2", name: "search_menu", arguments: { search: "rendang" } });
expect(menu.success).toBe(true);
expect(JSON.stringify(menu.data).toLowerCase()).toContain("rendang");

const invalid = await executeAITool({ id: "3", name: "check_availability", arguments: { date: "2026-08-20" } });
expect(invalid.success).toBe(false);
expect(invalid.errorCode).toBe("INVALID_TOOL_INPUT");

const unknown = await executeAITool({ id: "4", name: "unknown_tool" as any, arguments: {} });
expect(unknown.success).toBe(false);
expect(unknown.errorCode).toBe("UNKNOWN_TOOL");
```

- [ ] **Step 2: Run tool executor test and verify it fails**

Run: `npm test -- tests/ai/tool-executor.test.ts`

Expected: FAIL because tool files do not exist.

- [ ] **Step 3: Implement `lib/ai/tools/definitions.ts`**

Export:

```ts
export const PROTECTED_TOOL_NAMES: ToolName[] = ["create_reservation", "update_reservation", "cancel_reservation"];
export const RESTAURANT_TOOL_DEFINITIONS: LLMToolDefinition[] = [...];
```

Definitions must include `name`, `description`, and `parameters` for all 8 tools from the spec. Use JSON-schema object shapes with required fields for:

- `check_availability`: `date`, `time`, `guestCount`.
- `create_reservation`: `customerName`, `customerPhone`, `date`, `time`, `guestCount`.
- `get_reservation`: `code`.
- `update_reservation`: `code` plus optional `newDate`, `newTime`, `newGuestCount`, `preferredArea`, `notes`.
- `cancel_reservation`: `code`, optional `reason`.

- [ ] **Step 4: Implement `lib/ai/tools/restaurant-tools.ts`**

Wrap existing `restaurantStore` and export `restaurantTools: AIToolDefinition[]`.

Each tool should return the standard `ToolResult` shape. Map existing methods:

- `get_restaurant_info` -> `restaurantStore.getProfile()`.
- `get_menu` -> `restaurantStore.getMenuItems(category, search)`.
- `search_menu` -> `restaurantStore.getMenuItems("Semua", search)`.
- `check_availability` -> `restaurantStore.checkAvailability(date, time, guestCount, preferredArea)`.
- `create_reservation` -> `restaurantStore.createReservation(...)` with actor `AI Assistant`.
- `get_reservation` -> `restaurantStore.getReservationByCode(code)`.
- `update_reservation` -> `restaurantStore.updateReservation(...)` with actor `AI Assistant`.
- `cancel_reservation` -> `restaurantStore.updateReservationStatus(code, "cancelled", "AI Assistant", reason)`.

- [ ] **Step 5: Implement `lib/ai/tools/registry.ts`**

Export:

```ts
export const restaurantToolRegistry: Record<ToolName, AIToolDefinition>;
export function getAITool(name: string): AIToolDefinition | undefined;
export function getLLMToolDefinitions(): LLMToolDefinition[];
```

- [ ] **Step 6: Implement `executeAITool(call: ToolCallRequest): Promise<ToolResult>` in `lib/ai/tools/executor.ts`**

Behavior:

- Unknown tool returns `{ success: false, message: "Tool tidak dikenal.", errorCode: "UNKNOWN_TOOL" }`.
- Invalid required input returns `{ success: false, message: "Input tool tidak lengkap atau tidak valid.", errorCode: "INVALID_TOOL_INPUT" }`.
- Tool exceptions are caught and returned as `{ success: false, message: "Tool gagal dijalankan.", errorCode: "TOOL_EXECUTION_ERROR" }`.

Validate required fields manually based on tool name; do not add a schema validation dependency.

- [ ] **Step 7: Run tool executor test and verify it passes**

Run: `npm test -- tests/ai/tool-executor.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add lib/ai/tools tests/ai/tool-executor.test.ts
git commit -m "feat: add structured restaurant AI tools"
```

---

### Task 3: OpenRouter Provider Adapter

**Files:**
- Create: `lib/ai/providers/openrouter.ts`
- Test: `tests/ai/openrouter-provider.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`, `LLMChatInput`, `LLMChatOutput`, `ToolCallRequest` from `lib/ai/types.ts`.
- Produces: `createOpenRouterProvider(options?: OpenRouterProviderOptions): LLMProvider`, `getModelNameForRole(role: ModelRole): string`.

- [ ] **Step 1: Write failing provider tests in `tests/ai/openrouter-provider.test.ts`**

Test cases:

```ts
expect(getModelNameForRole("fast")).toBe(process.env.LLM_FAST_MODEL || process.env.LLM_DEFAULT_MODEL || "openai/gpt-4o-mini");

const provider = createOpenRouterProvider({ apiKey: "test-key", fetchImpl: mockFetch });
const output = await provider.chat({ model: "test/model", messages: [{ role: "user", content: "halo" }], tools: [] });
expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/chat/completions"), expect.objectContaining({ method: "POST" }));
expect(output.content).toBe("Halo juga!");
```

Also test missing API key:

```ts
const provider = createOpenRouterProvider({ apiKey: "", fetchImpl: mockFetch });
await expect(provider.chat(input)).rejects.toThrow("OPENROUTER_API_KEY belum diset");
```

- [ ] **Step 2: Run provider test and verify it fails**

Run: `npm test -- tests/ai/openrouter-provider.test.ts`

Expected: FAIL because provider file does not exist.

- [ ] **Step 3: Implement `getModelNameForRole(role: ModelRole): string`**

Mapping:

- `fast` -> `LLM_FAST_MODEL` fallback `LLM_DEFAULT_MODEL` fallback `openai/gpt-4o-mini`.
- `default` -> `LLM_DEFAULT_MODEL` fallback `openai/gpt-4o-mini`.
- `tool` -> `LLM_TOOL_MODEL` fallback `LLM_DEFAULT_MODEL` fallback `openai/gpt-4o-mini`.
- `reasoning` -> `LLM_REASONING_MODEL` fallback `LLM_DEFAULT_MODEL` fallback `openai/gpt-4o`.
- `classifier` -> `LLM_CLASSIFIER_MODEL` fallback `LLM_FAST_MODEL` fallback `openai/gpt-4o-mini`.

- [ ] **Step 4: Implement `createOpenRouterProvider(options?: OpenRouterProviderOptions): LLMProvider`**

`OpenRouterProviderOptions` fields:

```ts
apiKey?: string;
baseUrl?: string;
appUrl?: string;
appName?: string;
fetchImpl?: typeof fetch;
```

Provider behavior:

- Base URL default: `process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"`.
- Endpoint: `${baseUrl.replace(/\/$/, "")}/chat/completions`.
- Headers: `Authorization`, `Content-Type`, optional `HTTP-Referer`, optional `X-Title`.
- Request body includes `model`, `messages`, and `tools` when non-empty.
- Parse first choice message content and tool calls.
- Return `LLMChatOutput` with `content`, `toolCalls`, `raw`.
- Throw a descriptive error for non-2xx response.

- [ ] **Step 5: Run provider test and verify it passes**

Run: `npm test -- tests/ai/openrouter-provider.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add lib/ai/providers/openrouter.ts tests/ai/openrouter-provider.test.ts
git commit -m "feat: add OpenRouter AI provider"
```

---

### Task 4: AI Orchestrator, Confirmation Gate, and Trace

**Files:**
- Create: `lib/ai/orchestrator.ts`
- Create: `lib/ai/trace.ts`
- Test: `tests/ai/orchestrator.test.ts`

**Interfaces:**
- Consumes: `routeModel`, `LLMProvider`, `executeAITool`, `PROTECTED_TOOL_NAMES`, `getLLMToolDefinitions`.
- Produces: `processAIChatServer(request: AIChatRequest, options?: ProcessAIChatOptions): Promise<AIChatResponse>`, `createAITrace(input): AITrace`.

- [ ] **Step 1: Write failing orchestrator tests in `tests/ai/orchestrator.test.ts`**

Test cases:

```ts
const readOnlyProvider = fakeProviderWithToolCall("get_restaurant_info", {});
const res = await processAIChatServer({ message: "Alamat restoran di mana?" }, { provider: readOnlyProvider });
expect(res.toolCalls?.[0].name).toBe("get_restaurant_info");
expect(res.reply).toContain("Raso Minang");
expect(res.modelUsed).toBeTruthy();

const protectedProvider = fakeProviderWithToolCall("create_reservation", { customerName: "Budi", customerPhone: "081234567890", date: "2026-08-21", time: "19:00", guestCount: 4 });
const pending = await processAIChatServer({ message: "Booking atas nama Budi" }, { provider: protectedProvider });
expect(pending.pendingConfirmation?.toolName).toBe("create_reservation");
expect(pending.toolCalls).toEqual([]);
expect(pending.reply).toContain("konfirmasi");

const confirmed = await processAIChatServer({ message: "Ya, konfirmasi", pendingConfirmation: pending.pendingConfirmation }, { provider: protectedProvider });
expect(confirmed.toolCalls?.[0].name).toBe("create_reservation");
expect(confirmed.reply).toContain("Reservasi");

const missingKeyProvider = { chat: async () => { throw new Error("OPENROUTER_API_KEY belum diset"); } };
const error = await processAIChatServer({ message: "Halo" }, { provider: missingKeyProvider as any });
expect(error.reply).toContain("AI Assistant sedang mengalami kendala");
```

- [ ] **Step 2: Run orchestrator test and verify it fails**

Run: `npm test -- tests/ai/orchestrator.test.ts`

Expected: FAIL because orchestrator does not exist.

- [ ] **Step 3: Implement `lib/ai/trace.ts`**

Export:

```ts
export function createAITrace(input: Omit<AITrace, "requestId" | "timestamp">): AITrace;
```

Generate `requestId` as `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` and `timestamp` as `new Date().toISOString()`.

- [ ] **Step 4: Implement `processAIChatServer` in `lib/ai/orchestrator.ts`**

Signature:

```ts
export interface ProcessAIChatOptions {
  provider?: LLMProvider;
}

export async function processAIChatServer(
  request: AIChatRequest,
  options?: ProcessAIChatOptions
): Promise<AIChatResponse>
```

Behavior:

- Normalize empty messages; return safe help text for blank message.
- If `pendingConfirmation` exists and message confirms (`ya`, `setuju`, `oke`, `ok`, `lanjut`, `konfirmasi`, `benar`), execute the stored protected tool.
- If `pendingConfirmation` exists and message rejects (`batal`, `tidak`, `gak`), clear it and reply that action dibatalkan.
- Otherwise call `routeModel(request.message)` and provider with selected model and tool definitions.
- If provider returns read-only tool calls, execute each tool and build Indonesian reply from `userSafeMessage || message`.
- If provider returns protected tool call, do not execute; return `pendingConfirmation` with `toolName`, `arguments`, `summary`, and confirmation action buttons.
- If provider returns no tool call and text content exists, return it.
- If provider throws, return safe Indonesian error response with `modelUsed` from route decision and `routeReason`.

- [ ] **Step 5: Run orchestrator test and verify it passes**

Run: `npm test -- tests/ai/orchestrator.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add lib/ai/orchestrator.ts lib/ai/trace.ts tests/ai/orchestrator.test.ts
git commit -m "feat: add AI orchestrator confirmation flow"
```

---

### Task 5: `/api/ai/chat` Route Handler

**Files:**
- Create: `app/api/ai/chat/route.ts`
- Test: `tests/ai/api-contract.test.ts`

**Interfaces:**
- Consumes: `processAIChatServer(request: AIChatRequest): Promise<AIChatResponse>`.
- Produces: Next.js `POST(req: NextRequest)` route returning `AIChatResponse` JSON.

- [ ] **Step 1: Write API contract test in `tests/ai/api-contract.test.ts`**

Test cases can import `processAIChatServer` rather than booting Next:

```ts
const res = await processAIChatServer({ message: "" }, { provider: fakeProvider });
expect(res.reply).toContain("Halo");
expect(res.intent).toBeTruthy();
expect(res.modelUsed).toBeTruthy();
```

- [ ] **Step 2: Run API contract test and verify it fails if contract fields are missing**

Run: `npm test -- tests/ai/api-contract.test.ts`

Expected: FAIL until all response fields are present.

- [ ] **Step 3: Implement `app/api/ai/chat/route.ts`**

Route behavior:

- Export `async function POST(req: NextRequest)`.
- Parse JSON body as `AIChatRequest`.
- Validate `message` is a string; invalid body returns HTTP 400 JSON with safe reply.
- Call `processAIChatServer(body)`.
- Return `NextResponse.json(response)`.
- Catch unexpected errors and return HTTP 500 JSON with safe Indonesian error reply.

- [ ] **Step 4: Run API contract test and verify it passes**

Run: `npm test -- tests/ai/api-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add app/api/ai/chat/route.ts tests/ai/api-contract.test.ts
git commit -m "feat: add AI chat API route"
```

---

### Task 6: Chat UI Integration

**Files:**
- Modify: `components/AIChatWidget.tsx`
- Test: existing typecheck/build verification.

**Interfaces:**
- Consumes: `AIChatResponse` JSON from `POST /api/ai/chat`.
- Produces: Existing chat UI behavior using server AI responses.

- [ ] **Step 1: Modify imports in `components/AIChatWidget.tsx`**

Remove direct import:

```ts
import { processAIChat, ChatMessage } from "../lib/ai-assistant-service";
```

Replace with local or shared import for `ChatMessage` compatibility. Prefer moving only the `ChatMessage` type into `lib/ai/types.ts` as `UIChatMessage` if needed; do not keep importing `processAIChat`.

- [ ] **Step 2: Replace `processAIChat(query, messages, pendingConfirmation)` call**

In `handleSendMessage`, call:

```ts
const res = await fetch("/api/ai/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: query,
    history: messages,
    pendingConfirmation,
    context: { tenantId: "raso-minang-padang-01", locale: "id" },
  }),
});
```

Then parse as `AIChatResponse` and map:

- `reply` -> assistant message `text`.
- first `toolCalls` item -> message `toolCall`.
- `actionButtons` -> assistant message `actionButtons`.
- `pendingConfirmation` -> component state.

- [ ] **Step 3: Add UI error handling**

If fetch fails or non-2xx response has no valid JSON, append assistant message:

```text
Maaf, AI Assistant sedang mengalami kendala. Silakan coba lagi sebentar lagi.
```

- [ ] **Step 4: Preserve action button behavior**

Existing `show_menu`, `check_tables`, `show_hours`, `confirm_pending_booking`, `cancel_booking_prompt`, `check_code_*`, and `cancel_*` behaviors must still work.

- [ ] **Step 5: Run AI tests and typecheck**

Run:

```bash
npm test -- tests/ai
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add components/AIChatWidget.tsx lib/ai/types.ts
git commit -m "feat: connect chat widget to AI API"
```

---

### Task 7: Local Setup Documentation and Final Verification

**Files:**
- Create: `docs/llm-local-setup.md`
- Modify: none else unless verification reveals a defect.

**Interfaces:**
- Consumes: env variable names from spec and provider.
- Produces: PM/developer-readable local setup notes.

- [ ] **Step 1: Write `docs/llm-local-setup.md`**

Include:

- Required env vars: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_APP_URL`, `OPENROUTER_APP_NAME`, `LLM_FAST_MODEL`, `LLM_DEFAULT_MODEL`, `LLM_TOOL_MODEL`, `LLM_REASONING_MODEL`, `LLM_CLASSIFIER_MODEL`.
- Minimal local example with dummy non-secret values.
- Note that data is still local/mock and AI server store may not sync perfectly with browser localStorage.
- Manual test prompts from spec section 14.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all available commands pass. If `npm run build` cannot run because dependencies are missing, run `npm install` only if the human partner has explicitly allowed dependency installation in this workspace; otherwise report the blocked verification.

- [ ] **Step 3: Run manual smoke checklist locally if dev server is available**

If dependencies are installed and `npm run dev` is allowed, manually check:

- Ask: `Alamat restoran di mana?` -> tool-based restaurant info.
- Ask: `Berapa harga rendang?` -> menu/tool answer.
- Ask: `Ada meja untuk 4 orang besok jam 19.00?` -> availability/tool answer.
- Ask booking request -> confirmation prompt, not immediate mutation.

- [ ] **Step 4: Commit Task 7**

```bash
git add docs/llm-local-setup.md
git commit -m "docs: add OpenRouter local AI setup"
```

---

## Final Integration Checklist

- [ ] `components/AIChatWidget.tsx` no longer imports `processAIChat`.
- [ ] `app/api/ai/chat/route.ts` exists and returns `AIChatResponse` JSON.
- [ ] `routeModel` returns `modelUsed`/`routeReason` through the response path.
- [ ] `get_restaurant_info`, `get_menu`, `search_menu`, `check_availability`, `get_reservation` execute as read-only tools.
- [ ] `create_reservation`, `update_reservation`, `cancel_reservation` require `pendingConfirmation` before execution.
- [ ] Missing OpenRouter env returns safe UI response.
- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes or blocked reason is documented.
