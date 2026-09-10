Nah, kalau model AI-nya **sudah kamu punya**, justru bagian yang paling menarik adalah **AI Orchestration System**-nya.

Untuk chatbot restoran, saya tidak akan mendesain sistemnya sebagai:

> User → LLM → Jawaban

Tapi sebagai:

> **User → Understanding → Context → Decision → Knowledge/Tools → Validation → Response**

Dan ini memang lebih dekat dengan pola sistem AI assistant modern: model bukan satu-satunya “otak”, tetapi berada di tengah sebuah sistem yang mengatur **informasi, keputusan, tool, memory, dan validasi**.

---

# 1. Gambaran besar arsitektur

```text
                         ┌─────────────────────┐
                         │       CUSTOMER      │
                         │ WhatsApp / Web / IG │
                         └──────────┬──────────┘
                                    │
                                    ▼
                       ┌────────────────────────┐
                       │   API / Chat Gateway   │
                       │ auth, rate limit,      │
                       │ session, normalization │
                       └───────────┬────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     CONVERSATION ENGINE      │
                    │                              │
                    │  Intent + Context + State    │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┼───────────────┐
                    │              │               │
                    ▼              ▼               ▼
             ┌───────────┐   ┌───────────┐   ┌───────────┐
             │ Knowledge │   │ Tool      │   │ Business  │
             │ Retrieval │   │ Registry  │   │ Rules     │
             └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                   │               │               │
                   └───────────────┼───────────────┘
                                   ▼
                         ┌──────────────────┐
                         │   AI DECISION    │
                         │     ENGINE       │
                         └────────┬─────────┘
                                  │
                          ┌───────┴───────┐
                          │               │
                          ▼               ▼
                    Need tool?       Answer directly?
                          │               │
                          ▼               │
                     Tool Executor       │
                          │               │
                          └───────┬───────┘
                                  ▼
                         ┌──────────────────┐
                         │ RESPONSE GUARD   │
                         │ factuality/rules  │
                         │ safety/format     │
                         └────────┬─────────┘
                                  ▼
                         ┌──────────────────┐
                         │ RESPONSE BUILDER │
                         └────────┬─────────┘
                                  ▼
                              CUSTOMER
```

---

# 2. Jangan jadikan LLM sebagai pusat semuanya

Ini perubahan desain paling penting.

Jangan:

```text
LLM:
  "Kira-kira restoran buka atau tidak?"
```

Tetapi:

```text
System:
  "Cek business_rules / restaurant_status"
```

Kemudian:

```text
Tool:
  get_restaurant_status()
```

Menghasilkan:

```json
{
  "is_open": true,
  "closing_time": "22:00"
}
```

Baru AI menyusun:

> "Iya, kami masih buka. Restoran tutup pukul 22.00."

Artinya:

**AI bertugas mengambil keputusan dan berkomunikasi.**

Sedangkan:

**system bertugas menyediakan fakta.**

Ini sangat penting untuk akurasi.

---

# 3. Flow lengkap ketika customer bertanya

Contoh:

> "Mbak, ada makanan yang pedas tapi nggak terlalu pedas? Budget saya 50 ribu."

Flow internalnya bisa seperti ini.

---

## STEP 1 — Message Gateway

Customer mengirim:

```text
Mbak, ada makanan yang pedas tapi nggak terlalu pedas?
Budget saya 50 ribu.
```

Gateway melakukan:

```text
Authentication
↓
Rate Limit
↓
Normalize message
↓
Attach tenant_id
↓
Attach conversation_id
↓
Timestamp
```

Misalnya:

```json
{
  "tenant_id": "restaurant_001",
  "conversation_id": "conv_123",
  "user_id": "customer_456",
  "message": "...",
  "channel": "whatsapp"
}
```

---

# 4. Conversation Context Engine

Sebelum AI berpikir, sistem mengambil konteks.

Misalnya conversation sebelumnya:

```text
Customer:
Ada rekomendasi makanan?

AI:
Ada kak. Kakak lebih suka makanan pedas atau tidak?

Customer:
Pedas, tapi jangan terlalu pedas.
```

Jadi system tidak hanya mengirim:

```text
message terbaru
```

tetapi:

```text
conversation history
+
current message
+
customer profile
+
restaurant context
```

---

# 5. Context Builder

Context Builder menghasilkan sesuatu seperti:

```text
SYSTEM CONTEXT

Restaurant:
- Name: Warung Nusantara
- Cuisine: Indonesian
- Current time: 18:43
- Open: true
- Currency: IDR

Customer:
- Previous orders: 3
- Favorite category: noodles

Conversation:
- Customer likes spicy food
- Customer dislikes very spicy food

Current request:
- wants moderately spicy food
- budget <= 50k
```

Ini jauh lebih kuat daripada hanya mengirim chat history.

---

# 6. Intent Detection

Sistem kemudian menentukan:

```text
Intent:
MENU_RECOMMENDATION
```

Tetapi sebenarnya saya akan membuat intent system yang lebih fleksibel.

Contoh:

```text
ORDER
RESERVATION
MENU_QUERY
PRICE_QUERY
RECOMMENDATION
RESTAURANT_INFO
OPENING_HOURS
DELIVERY
COMPLAINT
PAYMENT
PROMOTION
CANCEL_ORDER
HUMAN_HANDOFF
GENERAL_CHAT
```

Dan bisa multi-intent.

Contoh:

> "Pesan 2 ayam geprek sama es teh, terus reservasi meja jam 7."

Menjadi:

```json
{
  "intents": [
    "ORDER",
    "RESERVATION"
  ]
}
```

---

# 7. AI Decision Engine

Ini bagian paling penting.

Decision Engine menentukan:

```text
Apakah cukup menjawab?
atau
harus mengambil data?
atau
harus menggunakan tool?
atau
harus bertanya balik?
atau
harus menyerahkan ke manusia?
```

Contoh:

### Pertanyaan

> "Restoran buka sampai jam berapa?"

Decision:

```text
Need external data?
YES

Tool:
get_restaurant_hours()
```

---

### Pertanyaan

> "Apa itu nasi goreng?"

Decision:

```text
Need external data?
NO

Answer directly
```

---

### Pertanyaan

> "Masih ada ayam geprek?"

Decision:

```text
Static knowledge?
NO

Realtime inventory required
→ get_inventory()
```

---

### Pertanyaan

> "Pesan dua ayam geprek."

Decision:

```text
Requires action
→ create_order()
```

---

# 8. Knowledge Layer

Knowledge sebaiknya dibagi menjadi beberapa sumber.

Jangan memasukkan semuanya ke satu vector database.

Saya akan membaginya:

```text
Restaurant Knowledge
│
├── Menu
├── Ingredients
├── Allergens
├── Pricing
├── Promotions
├── FAQ
├── Restaurant Information
├── Policies
├── SOP
└── Marketing Content
```

Kemudian realtime data:

```text
Operational Data
│
├── Inventory
├── Table availability
├── Opening status
├── Current promotion
├── Order status
└── Delivery status
```

Ini penting.

---

# 9. Static Knowledge vs Dynamic Knowledge

Salah satu kesalahan chatbot restoran adalah menganggap semua informasi sama.

Padahal:

### Static

```text
Nasi goreng menggunakan telur.
```

Tidak berubah setiap menit.

Bisa berasal dari:

```text
RAG / knowledge base
```

Tetapi:

### Dynamic

```text
Ayam geprek masih tersedia?
```

Harus:

```text
Database / inventory API
```

Jadi architecture:

```text
                    USER QUESTION
                         │
                         ▼
                  KNOWLEDGE TYPE?
                    /          \
                   /            \
              STATIC          DYNAMIC
                │                │
                ▼                ▼
             RAG/KB         API / Database
                │                │
                └───────┬────────┘
                        ▼
                    AI ENGINE
```

---

# 10. Retrieval Engine

Kalau menggunakan RAG, jangan:

```text
query → vector search → top 10 → LLM
```

Saya lebih menyarankan:

```text
User Query
    ↓
Query Analysis
    ↓
Metadata Filtering
    ↓
Hybrid Search
    ↓
Re-ranking
    ↓
Context Selection
    ↓
LLM
```

Contoh:

> "Menu ayam yang pedas di bawah 40 ribu"

Filter awal:

```text
tenant_id = restaurant_001
category = food
price <= 40000
spicy = true
```

Baru semantic search.

Jadi retrieval lebih presisi.

---

# 11. Tenant Isolation

Karena target kamu B2B SaaS, ini **wajib**.

Setiap request harus membawa:

```text
tenant_id
```

Misalnya:

```text
restaurant_A
restaurant_B
restaurant_C
```

Search:

```sql
WHERE tenant_id = ?
```

Bahkan vector database juga harus:

```text
metadata.tenant_id = restaurant_A
```

Jadi:

```text
Customer Restaurant A
       ↓
AI Engine
       ↓
Knowledge Retrieval
       ↓
FILTER tenant_id=A
       ↓
Restaurant A knowledge
```

AI tidak boleh pernah mendapatkan knowledge restaurant B.

---

# 12. Tool System

Saya justru menyarankan kamu membangun **Tool Registry**.

Contoh:

```text
TOOLS

get_menu()
get_menu_item()
search_menu()
get_inventory()
get_restaurant_status()

create_order()
update_order()
cancel_order()

check_table_availability()
create_reservation()
cancel_reservation()

get_order_status()

get_promotion()
calculate_order_total()

contact_human()
```

AI tidak perlu mengetahui implementasi backend.

AI hanya melihat:

```json
{
  "name": "check_table_availability",
  "description": "Check available tables",
  "parameters": {
    "date": "...",
    "time": "...",
    "guest_count": 0
  }
}
```

---

# 13. Tool Executor

AI:

```text
I need table availability
```

System:

```text
check_table_availability()
```

Backend:

```json
{
  "available": true,
  "tables": [
    {
      "table_id": "T12",
      "capacity": 4
    }
  ]
}
```

Baru AI menjawab customer.

---

# 14. Jangan biarkan AI bebas menjalankan semua tool

Ini penting untuk security.

Misalnya AI diberi tool:

```text
refund_order()
delete_customer()
change_price()
```

Jangan cukup dengan:

```text
LLM says → execute
```

Harus ada:

```text
LLM
 ↓
Permission Engine
 ↓
Business Rule Engine
 ↓
Tool Executor
```

Contoh:

```text
AI:
refund_order(123)

Permission Engine:
Allowed?

Business Rule:
Refund > 500.000 requires human approval

Result:
HUMAN_APPROVAL_REQUIRED
```

Kemudian chatbot:

> "Refund untuk pesanan tersebut perlu dikonfirmasi oleh tim kami terlebih dahulu."

---

# 15. Business Rule Engine

Ini yang membuat AI restoran menjadi **reliable**, bukan sekadar chatbot.

Contoh rules:

```text
ORDER_RULES

- Minimum order = Rp20.000
- Maximum quantity per item = 10
- Restaurant must be open
- Item must be available
- Reservation max 8 people online
- Discount cannot exceed 30%
```

AI tidak menentukan rules tersebut.

System menentukan.

---

# 16. Decision Loop

Sistem bisa dibuat seperti agent loop:

```text
User Input
    ↓
Understand
    ↓
Plan
    ↓
Need Information?
    ├── YES → Retrieve
    │            ↓
    │         Re-evaluate
    │
    └── NO
         ↓
Need Tool?
    ├── YES → Execute Tool
    │            ↓
    │         Re-evaluate
    │
    └── NO
         ↓
Generate Response
         ↓
Validate
         ↓
Send
```

Contoh:

```text
"Pesan 2 ayam geprek dan 2 es teh."

        ↓

Intent:
ORDER

        ↓

Need menu information?
YES

        ↓

get_menu_item()

        ↓

Need inventory?
YES

        ↓

get_inventory()

        ↓

Need calculation?
YES

        ↓

calculate_order_total()

        ↓

Need confirmation?
YES

        ↓

AI:
"Totalnya Rp48.000. Mau saya lanjutkan?"
```

---

# 17. Confirmation Layer

Untuk operasi yang memiliki konsekuensi, sistem harus punya confirmation state.

Misalnya:

```text
Customer:
Pesankan 5 ayam geprek.

AI:
Total Rp125.000. Saya proses sekarang?

Customer:
Ya.
```

State machine:

```text
IDLE
 ↓
ORDER_INTENT
 ↓
ORDER_BUILDING
 ↓
WAITING_CONFIRMATION
 ↓
CONFIRMED
 ↓
PROCESSING
 ↓
COMPLETED
```

Ini jauh lebih aman daripada LLM langsung melakukan transaksi.

---

# 18. Conversation State Machine

Saya menyarankan setiap conversation punya state.

Contoh:

```text
GREETING
DISCOVERY
RECOMMENDATION
ORDERING
CONFIRMATION
PAYMENT
FULFILLMENT
COMPLAINT
HUMAN_HANDOFF
CLOSED
```

Misalnya:

```text
Customer:
Ada rekomendasi?

DISCOVERY
   ↓
RECOMMENDATION

Customer:
Yang itu pesan 2.

RECOMMENDATION
   ↓
ORDERING
```

---

# 19. Memory Architecture

Jangan menyimpan semua chat sebagai "memory".

Pisahkan:

```text
Conversation History
        │
        ├── Short Term Memory
        │
        ├── Long Term Customer Memory
        │
        └── Business Memory
```

### Short-term

```text
10-20 pesan terakhir
```

### Customer memory

```text
favorite_food = ayam geprek
spicy_preference = medium
```

### Business memory

```text
restaurant tone = friendly
language = Indonesian
```

Dengan ini context tidak perlu terus membesar.

---

# 20. Context Compression

Ini bagian yang sangat penting kalau traffic besar.

Misalnya 200 pesan conversation.

Jangan kirim:

```text
200 pesan → LLM
```

System melakukan:

```text
200 messages
      ↓
Summarizer
      ↓
Conversation summary
```

Contoh:

```text
Customer wants moderately spicy food.
Budget around Rp50.000.
Previously ordered ayam geprek.
Currently considering dinner order.
```

Lalu:

```text
summary
+
recent messages
+
relevant memory
```

baru dikirim ke model.

Ini menghemat token dan meningkatkan speed.

---

# 21. Accuracy Layer

Untuk membuat AI akurat, jangan hanya mengandalkan prompt.

Buat beberapa lapisan.

```text
                 ACCURACY SYSTEM

Knowledge Retrieval
        +
Structured Data
        +
Tool Calls
        +
Business Rules
        +
Output Validation
        +
Confidence
```

Contoh:

AI mengatakan:

> "Ayam geprek tersedia."

System bisa memeriksa:

```text
inventory = 0
```

Maka jawaban diblok.

Jadi:

```text
AI response
    ↓
Fact Checker
    ↓
Contradiction detected
    ↓
Regenerate
```

---

# 22. Response Validator

Output AI bisa divalidasi secara programmatic.

Misalnya AI menghasilkan:

```json
{
  "intent": "ORDER",
  "items": [
    {
      "name": "Ayam Geprek",
      "qty": 2,
      "price": 15000
    }
  ]
}
```

System cek:

```text
Does menu item exist?
Does price match database?
Is quantity allowed?
Is inventory sufficient?
```

Kalau harga database:

```text
Rp18.000
```

sedangkan AI:

```text
Rp15.000
```

AI output ditolak.

---

# 23. Confidence System

Kamu juga bisa membuat confidence score.

Contoh:

```text
Intent confidence: 0.98
Retrieval confidence: 0.91
Tool result confidence: 1.00
Answer confidence: 0.94
```

Kemudian aturan:

```text
> 0.90
→ answer

0.70 - 0.90
→ answer carefully / clarification

< 0.70
→ ask clarification / human
```

Misalnya:

> "Saya mau yang itu."

AI tidak tahu "itu" apa.

Daripada halusinasi:

```text
Confidence = LOW
```

AI bertanya:

> "Yang kakak maksud ayam geprek tadi atau mie ayam?"

---

# 24. Latency Architecture

Untuk speed, jangan semua proses sequential.

Bad:

```text
Intent
 ↓
Memory
 ↓
RAG
 ↓
Inventory
 ↓
Menu
 ↓
Promotion
 ↓
LLM
```

Bisa lama.

Lebih bagus:

```text
                  ┌── Memory
                  │
User → Analyze ───┼── Retrieval
                  │
                  ├── Customer Profile
                  │
                  └── Restaurant Context
                         ↓
                      AI Engine
```

Paralel request.

Misalnya:

```text
get_customer_context()
get_restaurant_context()
search_knowledge()
```

dijalankan bersamaan.

---

# 25. Cache

Tambahkan cache untuk data yang sering dipakai.

Contoh:

```text
Restaurant information
Menu
Opening hours
Promotions
FAQ
```

Redis:

```text
restaurant:123:menu
restaurant:123:hours
restaurant:123:promotion
```

Tidak perlu query database setiap kali customer bertanya.

---

# 26. Streaming Response

Untuk UX, jangan tunggu seluruh response.

Bisa:

```text
Customer
   ↓
AI thinking
   ↓
stream:
"Baik kak,"
   ↓
"untuk yang pedasnya sedang,"
   ↓
"saya rekomendasikan..."
```

Tetapi tool execution tetap harus selesai sebelum fakta penting dikirim.

Jangan:

> "Ayam geprek masih tersedia..."

sebelum inventory dicek.

---

# 27. Parallel Tool Execution

Misalnya customer:

> "Cari makanan pedas di bawah 50 ribu dan yang masih tersedia."

System bisa:

```text
search_menu()
       │
       ├── filter spicy
       └── price <= 50000
                ↓
         get_inventory()
                ↓
             merge
```

Atau lebih optimal:

```text
Menu retrieval
+
Inventory retrieval
```

parallel.

---

# 28. Guardrail Layer

Sebelum response keluar:

```text
             RESPONSE
                 ↓
        ┌─────────────────┐
        │ Guardrail Layer │
        └────────┬────────┘
                 │
       ┌─────────┼──────────┐
       ▼         ▼          ▼
    Factual    Policy     Security
    check      check       check
       │         │          │
       └─────────┼──────────┘
                 ▼
              OUTPUT
```

Contoh:

AI mencoba:

> "Saya bisa memberikan nomor kartu kredit pelanggan sebelumnya."

Guardrail:

```text
BLOCK
```

---

# 29. Human Handoff

AI tidak boleh memaksakan diri.

Buat kondisi:

```text
Low confidence
Customer angry
Payment dispute
Refund
Complex complaint
Explicit human request
Sensitive situation
Tool failure
```

Flow:

```text
AI
 ↓
HANDOFF_REQUIRED
 ↓
Human Agent
```

Conversation tidak perlu dimulai ulang.

Agent mendapatkan:

```text
Customer profile
Conversation summary
Recent messages
Detected intent
Actions already executed
Relevant order
```

---

# 30. Observability

Ini sering dilupakan.

Kamu perlu melihat:

```text
Conversation ID
Tenant ID
Model latency
Retrieval latency
Tool latency
Total latency
Tokens
Intent
Tools used
Knowledge chunks
Confidence
Final response
Errors
Fallbacks
```

Misalnya:

```text
Conversation #123

Total latency: 1.84 sec

Intent detection: 120 ms
Memory retrieval: 80 ms
RAG: 240 ms
Inventory API: 130 ms
LLM: 1.1 sec
Validation: 80 ms
```

Nanti kamu bisa tahu:

> "Kenapa chatbot saya lambat?"

Bukan sekadar menebak.

---

# 31. AI Evaluation System

Ini bahkan bisa menjadi sistem terpisah.

Kamu punya dataset:

```text
Question
Expected Intent
Expected Answer
Expected Tool
Expected Result
```

Contoh:

```text
Q:
Masih buka?

Expected:
get_restaurant_status()

Q:
Ada menu vegetarian?

Expected:
search_menu(filter=vegetarian)

Q:
Pesan 2 nasi goreng.

Expected:
create_order()
```

Kemudian setiap perubahan system dites otomatis.

---

# 32. Arsitektur final yang saya rekomendasikan

Kalau saya susun sebagai production architecture untuk SaaS restoranmu:

```text
                         CUSTOMER
                            │
                            ▼
                   CHANNEL CONNECTOR
                 WhatsApp / Web / IG
                            │
                            ▼
                     API GATEWAY
                            │
                            ▼
                 CONVERSATION MANAGER
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
         CONTEXT ENGINE           STATE ENGINE
                │                       │
        ┌───────┼────────┐              │
        │       │        │              │
        ▼       ▼        ▼              ▼
     MEMORY   PROFILE   TENANT       STATE
        │       │        │              │
        └───────┼────────┘              │
                ▼                       │
          AI ORCHESTRATOR ◄────────────┘
                │
        ┌───────┼───────────────┐
        │       │               │
        ▼       ▼               ▼
     RETRIEVAL TOOLS      BUSINESS RULES
        │       │               │
        │       ▼               │
        │  TOOL EXECUTOR        │
        │       │               │
        └───────┼───────────────┘
                ▼
            AI MODEL
                │
                ▼
         RESPONSE VALIDATOR
                │
        ┌───────┴─────────┐
        │                 │
     VALID               INVALID
        │                 │
        │              REGENERATE
        │
        ▼
      GUARDRAIL
        │
        ▼
   RESPONSE BUILDER
        │
        ▼
      CUSTOMER
```

---

# 33. Dan ada satu konsep yang menurut saya paling penting

Jangan berpikir:

> **"Saya sedang membuat chatbot restoran."**

Lebih tepat:

> **"Saya sedang membuat AI operating layer untuk restoran."**

Chatbot hanyalah interface.

Di belakangnya ada:

```text
                 RESTAURANT AI OS

                    ┌─────────┐
                    │   AI    │
                    └────┬────┘
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
       ▼                 ▼                  ▼
   Knowledge          Decision             Memory
       │                 │                  │
       ▼                 ▼                  ▼
    Business           Tools              Customer
       │                 │                  │
       └─────────────────┼──────────────────┘
                         │
                         ▼
                    Operations
```

AI kemudian bukan cuma:

> "menjawab pertanyaan."

Tetapi:

> **memahami → mencari fakta → mengambil keputusan → menggunakan tool → memeriksa hasil → mengambil tindakan → menjelaskan hasil.**

Dan ini yang membuat sistemmu nanti bisa berkembang dari:

```text
AI Restaurant Chatbot
```

menjadi:

```text
AI Sales Assistant
        ↓
AI Order Assistant
        ↓
AI Reservation Assistant
        ↓
AI Customer Support
        ↓
AI Restaurant Operations Agent
```

Yang paling menarik, **model AI-mu bisa diganti kapan saja** tanpa merombak keseluruhan sistem. Karena model hanyalah salah satu komponen di dalam **Orchestrator**. Ini membuat arsitekturmu jauh lebih tahan terhadap pergantian model dan provider.
