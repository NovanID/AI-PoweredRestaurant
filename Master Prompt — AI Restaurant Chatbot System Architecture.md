# MASTER PROMPT — AI RESTAURANT CHATBOT SYSTEM

## ROLE

Kamu bertindak sebagai **Principal AI Systems Architect + Backend Architect + AI Agent Architect** yang bertanggung jawab merancang arsitektur production-grade untuk sistem **AI Restaurant Chatbot** berbasis SaaS multi-tenant.

Saya **SUDAH memiliki model AI sendiri**. Jangan membahas cara membuat, fine-tuning, training, atau memilih model AI.

Fokus utama kamu adalah:

- AI orchestration
- decision making
- context management
- retrieval
- tool calling
- business rules
- realtime event handling
- memory
- conversation state
- validation
- guardrails
- latency optimization
- concurrency
- reliability
- observability
- error recovery
- human handoff
- multi-tenant isolation

Sistem harus dirancang seperti **AI assistant modern**, di mana LLM bukan satu-satunya sumber kebenaran dan bukan satu-satunya komponen yang mengambil keputusan.

---

# 1. BUSINESS CONTEXT

Saya sedang membangun platform SaaS untuk bisnis restoran.

Setiap restoran adalah tenant.

Contoh:

```text
Tenant A
├── identity
├── branding
├── menu
├── pricing
├── ingredients
├── allergens
├── inventory
├── promotions
├── restaurant rules
├── business hours
├── tables
├── reservations
├── orders
├── customers
└── AI configuration
```

Tenant lain:

```text
Tenant B
Tenant C
Tenant D
```

AI harus benar-benar memahami konteks masing-masing restoran.

AI Restaurant Assistant harus dapat:

- menjawab pertanyaan pelanggan
- menjelaskan menu
- menjelaskan harga
- memberikan rekomendasi makanan
- memahami preferensi pelanggan
- mencari informasi restoran
- memeriksa ketersediaan menu
- memeriksa stok
- menghitung harga
- membuat order
- mengubah order
- membatalkan order
- membuat reservation
- mengecek reservation
- mengecek status order
- menjelaskan promo
- menangani komplain
- melakukan escalation ke human agent

---

# 2. IMPORTANT ARCHITECTURAL PRINCIPLE

Jangan membuat desain:

```text
User
↓
LLM
↓
Response
```

Gunakan desain:

```text
User
↓
Gateway
↓
Conversation Manager
↓
Context Engine
↓
AI Orchestrator
↓
Decision
↓
Knowledge / Retrieval / Tools
↓
Validation
↓
Guardrails
↓
Response
↓
User
```

Model AI hanya menjadi salah satu komponen.

---

# 3. PRIMARY DESIGN GOAL

Desain sistem agar memiliki empat karakter utama:

## Accuracy

AI harus menggunakan:

- structured data
- database
- retrieval
- tool results
- business rules
- validation

AI tidak boleh mengarang data penting.

Contoh:

Jangan:

```text
AI:
Ayam geprek masih tersedia.
```

kalau belum memeriksa inventory.

Harus:

```text
AI
↓
check_inventory()
↓
inventory result
↓
response
```

---

## Speed

Sistem harus mengoptimalkan:

- parallel retrieval
- caching
- asynchronous processing
- streaming
- context compression
- connection pooling
- tool batching
- selective retrieval

Jangan membuat semua dependency berjalan sequential jika bisa dilakukan parallel.

---

## Decision Quality

AI harus bisa menentukan:

```text
answer directly
retrieve information
call tool
ask clarification
request confirmation
reject action
handoff to human
```

---

## Reliability

Jika satu service gagal:

```text
LLM timeout
database timeout
inventory unavailable
retrieval unavailable
payment service unavailable
```

sistem tidak boleh langsung crash.

Harus terdapat:

- retry
- timeout
- circuit breaker
- fallback
- graceful degradation
- idempotency
- recovery mechanism

---

# 4. HIGH LEVEL COMPONENTS

Minimal desain harus mempunyai komponen:

```text
Channel Adapter
API Gateway
Conversation Service
Conversation State Manager
Context Engine
Customer Profile Service
Memory Service
Knowledge Service
Retrieval Service
AI Orchestrator
Decision Engine
Tool Registry
Tool Executor
Business Rule Engine
Inventory Service
Order Service
Reservation Service
Promotion Service
Response Validator
Guardrail Service
Human Handoff Service
Event Bus
Realtime Gateway
Notification Service
Cache
Observability
Evaluation System
```

Jelaskan fungsi setiap komponen.

---

# 5. REALTIME EVENT ARCHITECTURE

Sistem harus memiliki event-driven architecture.

Gunakan konsep seperti:

```text
Event Producer
↓
Event Bus
↓
Consumers
```

Contoh event:

```text
message.received
message.processing
intent.detected
context.loaded
retrieval.started
retrieval.completed
tool.requested
tool.executing
tool.completed
tool.failed
decision.created
response.generated
response.validated
message.sent

order.created
order.updated
order.cancelled

inventory.updated

reservation.created
reservation.updated

promotion.updated

restaurant.opened
restaurant.closed

human.handoff.requested
human.handoff.accepted
```

Jelaskan event schema.

Contoh:

```json
{
  "event_id": "evt_xxx",
  "event_type": "inventory.updated",
  "tenant_id": "restaurant_001",
  "aggregate_id": "menu_item_123",
  "timestamp": "2026-08-27T14:30:00Z",
  "payload": {}
}
```

---

# 6. REALTIME CHAT FLOW

Tunjukkan secara detail apa yang terjadi ketika customer mengirim:

```text
"Mbak ada ayam yang pedas tapi jangan terlalu pedas?
Budget saya 50 ribu."
```

Flow harus dijelaskan dalam urutan realtime:

```text
T+0 ms
Customer sends message

T+20 ms
Gateway receives message

T+30 ms
Message normalized

T+40 ms
Conversation loaded

T+50 ms
Tenant context loaded

T+70 ms
Customer profile loaded

T+100 ms
Intent classification

T+120 ms
Retrieval launched

T+120 ms
Menu search launched

T+120 ms
Preference lookup launched

T+200 ms
Results merged

T+250 ms
Decision engine evaluates

T+300 ms
Candidate menu generated

T+350 ms
Business rules validated

T+400 ms
Response generation begins

T+450 ms
Streaming response starts

T+900 ms
Final response delivered
```

Angka latency di atas hanya contoh.

Tugasmu adalah membuat **realistic architecture**, bukan mempertahankan angka tersebut.

---

# 7. SECOND REALTIME SCENARIO — ORDER

Gunakan scenario:

```text
Customer:
"Pesankan 2 ayam geprek dan 2 es teh."
```

Jelaskan secara realtime:

```text
message.received
↓
intent.detected
↓
order intent
↓
parse items
↓
validate menu items
↓
check inventory
↓
calculate total
↓
check restaurant status
↓
check business rules
↓
generate order preview
↓
WAITING_CONFIRMATION
```

AI harus menjawab:

```text
"Totalnya Rp48.000.
Mau saya lanjutkan pesanannya?"
```

Kemudian customer:

```text
"Ya."
```

Flow:

```text
confirmation received
↓
idempotency check
↓
create order
↓
reserve inventory
↓
emit order.created
↓
update conversation state
↓
notify restaurant
↓
send confirmation
```

---

# 8. CRITICAL REQUIREMENT — NEVER TRUST LLM FOR FACTS

Pisahkan:

## Static Knowledge

Contoh:

```text
ingredients
menu description
restaurant FAQ
restaurant history
policies
```

Gunakan:

```text
Knowledge Base
RAG
Search
```

## Dynamic Knowledge

Contoh:

```text
inventory
table availability
restaurant open/closed
order status
promotion
pricing
delivery status
```

Gunakan:

```text
Database
API
Realtime events
Tools
```

Jelaskan keputusan arsitektural ini secara detail.

---

# 9. TOOL SYSTEM

Buat Tool Registry.

Contoh tools:

```text
get_restaurant_status()
get_restaurant_hours()
search_menu()
get_menu_item()
get_inventory()
get_active_promotions()

calculate_order_total()
create_order()
update_order()
cancel_order()
get_order_status()

check_table_availability()
create_reservation()
cancel_reservation()

contact_human()
```

Setiap tool harus mempunyai:

```text
name
description
input schema
output schema
permission
timeout
retry policy
idempotency requirement
audit requirement
tenant scope
```

Jelaskan bagaimana AI memilih tool.

---

# 10. TOOL EXECUTION SAFETY

Jangan:

```text
LLM → execute tool
```

Gunakan:

```text
LLM
↓
Decision Engine
↓
Permission Engine
↓
Business Rule Engine
↓
Tool Executor
↓
Tool
```

Contoh:

```text
refund_order()
```

tidak boleh langsung dieksekusi.

Harus:

```text
permission check
↓
amount check
↓
business policy
↓
human approval if necessary
```

---

# 11. CONVERSATION STATE MACHINE

Buat state machine:

```text
IDLE
↓
DISCOVERY
↓
RECOMMENDATION
↓
ORDERING
↓
CONFIRMATION
↓
PROCESSING
↓
COMPLETED
```

Juga support:

```text
RESERVATION
PAYMENT
COMPLAINT
HUMAN_HANDOFF
CANCELLED
FAILED
```

Jelaskan:

- state transition
- invalid transition
- timeout
- recovery
- concurrent messages
- race condition

---

# 12. CONCURRENT MESSAGE HANDLING

Pertimbangkan kasus:

Customer mengirim:

```text
"Pesan 2 ayam geprek"
```

0.3 detik kemudian:

```text
"Tambah 1 es teh"
```

Kemudian:

```text
"Eh jangan jadi"
```

Sistem harus menjelaskan bagaimana menangani:

- ordering
- message sequencing
- event ordering
- optimistic concurrency
- locking
- idempotency
- cancellation
- stale state

Jangan mengasumsikan customer selalu mengirim satu pesan lalu menunggu response.

---

# 13. CUSTOMER MEMORY

Pisahkan:

```text
Short Term Memory
Long Term Memory
Customer Profile
Conversation Summary
Restaurant Context
```

Contoh:

```text
Customer likes:
- spicy level medium
- chicken dishes
- budget around 50k
```

Jelaskan kapan informasi tersebut:

- disimpan
- diperbarui
- dihapus
- dipakai
- diabaikan

Jangan menyimpan semua chat sebagai memory.

---

# 14. CONTEXT ENGINE

Context yang dikirim ke AI harus merupakan hasil dari:

```text
System instructions
+
Tenant context
+
Restaurant context
+
Conversation summary
+
Recent conversation
+
Customer preferences
+
Retrieved knowledge
+
Tool results
+
Current state
```

Jelaskan bagaimana context dibentuk secara dinamis.

Jangan selalu mengirim semua data.

---

# 15. CONTEXT BUDGET

Desain context management agar:

```text
old conversation
↓
summary
↓
relevant facts
↓
recent messages
```

Jelaskan:

- token budgeting
- truncation
- summarization
- relevance scoring
- priority rules

---

# 16. RETRIEVAL PIPELINE

Gunakan pipeline:

```text
User Query
↓
Query Understanding
↓
Tenant Filter
↓
Metadata Filter
↓
Keyword Search
+
Vector Search
↓
Hybrid Merge
↓
Re-ranking
↓
Context Selection
↓
AI
```

Pastikan retrieval selalu terisolasi berdasarkan:

```text
tenant_id
```

---

# 17. MULTI-TENANT SECURITY

Setiap request dan retrieval harus mengetahui:

```text
tenant_id
```

Contoh:

```text
Customer Restaurant A
↓
AI
↓
Knowledge Query
↓
WHERE tenant_id = A
```

Pastikan tidak ada kemungkinan:

```text
Restaurant A → retrieve Restaurant B knowledge
```

Bahas:

- tenant isolation
- database isolation
- vector metadata isolation
- cache isolation
- event isolation
- authorization

---

# 18. BUSINESS RULE ENGINE

AI tidak boleh menentukan aturan bisnis kritis.

Contoh:

```text
restaurant must be open
minimum order
maximum quantity
promotion validity
inventory availability
reservation rules
refund rules
discount limits
```

Buat:

```text
Business Rule Engine
```

yang dapat digunakan oleh AI dan backend.

---

# 19. RESPONSE VALIDATION

Sebelum response dikirim:

```text
AI Response
↓
Fact Validation
↓
Business Rule Validation
↓
Security Validation
↓
Policy Validation
↓
Response Formatting
↓
Send
```

Contoh:

Database:

```text
Ayam Geprek = Rp18.000
```

Tetapi AI menghasilkan:

```text
Rp15.000
```

Response harus ditolak.

---

# 20. HALLUCINATION CONTROL

Desain mekanisme:

```text
Known fact
Unknown fact
Uncertain fact
Realtime fact
```

Jika AI tidak mempunyai informasi:

```text
DO NOT INVENT
```

Gunakan:

```text
clarification
retrieval
tool call
human escalation
```

---

# 21. CONFIDENCE SYSTEM

Buat confidence untuk:

```text
intent
retrieval
entity extraction
tool selection
final answer
```

Contoh:

```text
confidence > 0.90
→ execute normally

0.70 - 0.90
→ cautious answer / clarification

< 0.70
→ ask clarification or human handoff
```

Jelaskan bahwa confidence jangan hanya berasal dari model probability.

Gunakan evidence-based confidence.

---

# 22. ERROR HANDLING

Jelaskan flow jika:

## LLM timeout

```text
timeout
↓
retry
↓
fallback
↓
safe response
```

## Inventory API down

```text
inventory unavailable
↓
do not claim item is available
↓
tell customer availability cannot be confirmed
```

## Database failure

```text
retry
↓
circuit breaker
↓
degraded mode
```

## Tool returns conflicting data

```text
conflict detected
↓
do not continue blindly
↓
reconciliation / human escalation
```

---

# 23. REALTIME RESTAURANT EVENTS

Desain realtime synchronization.

Contoh:

Restaurant employee mengubah:

```text
Ayam Geprek
Available → SOLD OUT
```

Event:

```text
inventory.updated
```

Flow:

```text
Admin POS
↓
Inventory Service
↓
Event Bus
↓
Knowledge cache invalidation
↓
AI context update
↓
Active conversations potentially notified
```

Jelaskan apakah AI harus langsung mengubah conversation context atau hanya menggunakan data realtime pada request berikutnya.

---

# 24. PROMOTION REALTIME

Contoh:

Jam 18:00 restoran mengaktifkan:

```text
Diskon 20%
```

Flow:

```text
Promotion Service
↓
promotion.activated
↓
Cache invalidation
↓
AI can retrieve latest promotion
```

AI tidak boleh menggunakan promo lama.

---

# 25. RESTAURANT OPEN/CLOSE EVENTS

Contoh:

```text
restaurant.opened
restaurant.closed
```

Jika restoran tutup:

```text
AI receives customer order
↓
check restaurant status
↓
restaurant.closed
↓
do not create order
```

---

# 26. EVENT-DRIVEN + REQUEST-RESPONSE

Jangan gunakan event-driven untuk semuanya.

Tentukan mana yang cocok untuk:

```text
synchronous request
```

dan mana yang cocok untuk:

```text
asynchronous event
```

Berikan reasoning.

---

# 27. CACHING

Tentukan data yang cocok untuk cache:

```text
menu
restaurant information
opening hours
promotions
FAQ
```

Dan data yang seharusnya tidak dipercaya hanya dari cache:

```text
inventory
order status
payment status
reservation availability
```

Jelaskan TTL, invalidation, dan consistency.

---

# 28. STREAMING

Desain streaming response.

Contoh:

```text
Customer:
Ada rekomendasi makanan pedas?

AI:
"Baik kak..."
```

Tetapi jangan stream fakta yang belum divalidasi.

Contoh yang salah:

```text
"Menu X masih tersedia..."
```

sebelum inventory diperiksa.

---

# 29. LATENCY OPTIMIZATION

Analisis:

```text
Gateway latency
DB latency
Cache latency
Retrieval latency
Tool latency
LLM latency
Response validation latency
```

Buat strategi:

```text
parallel execution
cache
prefetch
connection pooling
batching
streaming
context reduction
timeout budget
```

Berikan contoh target latency realistis dan breakdown.

---

# 30. OBSERVABILITY

Setiap conversation harus mempunyai trace.

Contoh:

```text
trace_id
conversation_id
tenant_id
message_id
```

Trace:

```text
gateway
↓
context
↓
retrieval
↓
decision
↓
tool
↓
LLM
↓
validator
↓
response
```

Log minimal:

```text
latency
tokens
tool calls
retrieval results
decision
errors
fallback
confidence
```

---

# 31. AUDIT LOG

Semua tindakan yang mempunyai efek terhadap bisnis harus dapat diaudit.

Contoh:

```text
order.created
order.updated
order.cancelled
reservation.created
reservation.cancelled
refund.requested
human.handoff
```

Audit record:

```text
who
what
when
tenant
conversation
tool
input
result
decision
```

---

# 32. HUMAN HANDOFF

AI harus tahu kapan berhenti.

Trigger:

```text
customer explicitly asks for human
low confidence
angry customer
payment dispute
refund issue
complex complaint
tool failure
business policy violation
```

Ketika handoff:

```text
AI
↓
human_handoff.requested
↓
Agent Queue
↓
Human Agent
```

Agent harus menerima:

```text
conversation summary
customer profile
current order
intent
recent messages
actions already taken
reason for escalation
```

---

# 33. EVALUATION SYSTEM

Buat dataset evaluasi:

```text
input
expected intent
expected tool
expected facts
expected response characteristics
```

Test:

```text
accuracy
tool selection
hallucination
latency
recovery
multi-turn consistency
tenant isolation
```

Jelaskan bagaimana regression testing dilakukan setiap kali AI orchestration berubah.

---

# 34. FAILURE SCENARIOS

Wajib simulasikan minimal:

```text
customer sends duplicate message
customer sends messages rapidly
inventory changes during conversation
menu price changes during order
restaurant closes during ordering
promotion expires during conversation
tool timeout
database timeout
LLM timeout
retrieval returns irrelevant result
retrieval returns conflicting results
customer cancels midway
two devices send same conversation
human agent joins conversation
order creation executed twice
```

Untuk setiap scenario jelaskan:

```text
Initial state
Event
System reaction
State transition
Recovery
Final state
```

---

# 35. COMPLETE REALTIME EXAMPLE

Berikan satu simulasi penuh seperti berikut:

```text
18:43:01 Customer:
"Mbak saya mau makanan pedas, budget 50 ribu."

18:43:01.020
message.received

18:43:01.050
conversation loaded

18:43:01.080
tenant context loaded

18:43:01.100
intent = recommendation

18:43:01.120
parallel retrieval:
- menu
- customer preference
- active promotions

18:43:01.280
results merged

18:43:01.300
decision:
recommendation required

18:43:01.500
candidate items generated

18:43:01.550
business constraints validated

18:43:01.600
response streaming starts

18:43:02.200
final response delivered
```

Lalu lanjutkan conversation:

```text
Customer:
"Yang ayam geprek pesan 2."

Customer:
"Tambah es teh 2."

Customer:
"Eh jangan pedas banget."
```

Tunjukkan bagaimana sistem menangani ketiga message tersebut secara realtime dan bagaimana state berubah.

---

# 36. OUTPUT FORMAT

Jangan hanya memberi diagram.

Output harus terdiri dari:

## A. System Architecture

Berikan diagram ASCII lengkap.

## B. Component Responsibilities

Jelaskan setiap service.

## C. Request Flow

Jelaskan request synchronous flow.

## D. Realtime Event Flow

Jelaskan event-driven flow.

## E. AI Decision Flow

Jelaskan bagaimana AI menentukan:

```text
answer
retrieve
tool
clarification
confirmation
handoff
```

## F. State Machine

Berikan state transition diagram.

## G. Memory Architecture

Jelaskan short-term dan long-term memory.

## H. Retrieval Architecture

Jelaskan RAG + structured data + realtime data.

## I. Tool Architecture

Jelaskan tool registry dan executor.

## J. Business Rule Architecture

Jelaskan rule engine.

## K. Validation Architecture

Jelaskan hallucination prevention dan response validation.

## L. Realtime Scenarios

Simulasikan minimal 5 kejadian realtime lengkap dengan timestamp.

## M. Failure Handling

Simulasikan failure dan recovery.

## N. Multi-Tenant Security

Jelaskan isolation.

## O. Observability

Jelaskan tracing, logs, metrics.

## P. Performance

Jelaskan latency optimization.

## Q. Data Flow

Buat data-flow diagram.

## R. Event Flow

Buat event-flow diagram.

## S. Production Architecture

Gabungkan seluruh komponen menjadi satu architecture diagram.

---

# 37. VERY IMPORTANT

Jangan membuat arsitektur yang terlalu sederhana.

Jangan menganggap:

```text
LLM = backend
```

Jangan menganggap:

```text
RAG = database
```

Jangan menganggap:

```text
Tool calling = langsung menjalankan function
```

Jangan menganggap:

```text
Chat history = memory
```

Jangan menganggap:

```text
AI response = truth
```

Jangan menganggap:

```text
Realtime = WebSocket saja
```

Sistem harus dipandang sebagai:

```text
AI APPLICATION
+
STATE MACHINE
+
KNOWLEDGE SYSTEM
+
TOOL SYSTEM
+
EVENT SYSTEM
+
BUSINESS RULES
+
VALIDATION
+
OBSERVABILITY
```

---

# 38. FINAL DESIGN PRINCIPLE

Tujuan akhir adalah menghasilkan sistem di mana:

```text
AI decides
System verifies
Tools execute
Database stores truth
Events synchronize state
Business rules constrain actions
Validators prevent bad output
Humans handle exceptions
```

Dengan prinsip:

```text
AI should not invent facts.
AI should not directly control critical business operations.
AI should retrieve facts when necessary.
AI should use tools when realtime data is required.
AI should ask clarification when uncertain.
AI should ask confirmation before consequential actions.
AI should gracefully fail.
AI should be observable and auditable.
```

Rancang arsitektur ini agar nantinya chatbot dapat berkembang menjadi:

```text
Restaurant AI Chatbot
        ↓
AI Sales Assistant
        ↓
AI Ordering Agent
        ↓
AI Reservation Agent
        ↓
AI Customer Support Agent
        ↓
AI Restaurant Operations Agent
```

Tanpa mengganti core orchestration architecture.