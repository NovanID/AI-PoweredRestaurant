# 🚀 Enterprise AI Restaurant OS — System Architecture Blueprint & Key Insights

> **Dokumen Insight & Fondasi Sistem**: Panduan arsitektur orkestrasi AI tingkat produksi (*production-grade*) untuk SaaS Restoran Multi-Tenant.

---

## 📌 1. Prinsip Inti: "Restaurant AI OS"
1. **LLM Sebagai Communication & Decision Layer**: Model AI bukan satu-satunya penentu kebenaran (*ground truth*). AI bertugas mengolah bahasa alami, mengekstrak niat (*intent*), dan merangkai jawaban komunikatif.
2. **Deterministic Single Source of Truth**: Database, Business Rule Engine, dan Tool Registry adalah penyedia fakta mutlak (stok, harga, ketersediaan meja, status buka/tutup).
3. **Strict Multi-Tenant Isolation**: Setiap eksekusi, memori, konteks, dan pencarian knowledge base wajib membawa `tenant_id` yang terisolasi ketat.

---

## 🏗️ 2. Arsitektur Orkestrasi End-to-End

```text
[Customer / Omnichannel: WA, Web, IG]
                  │
                  ▼
[1. Ingress & API Gateway] ── (Rate Limit, Tenant Auth, Idempotency Deduplication)
                  │
                  ▼
[2. Conversation State Engine] ── (Redlock per Conversation, FSM State: IDLE -> DISCOVERY -> CONFIRMATION)
                  │
                  ▼
[3. Context & Memory Engine] ── (Token Budgeting, 4-Tier Memory, Context Summarizer)
                  │
                  ▼
[4. Intent & Decision Engine] ── (Direct Answer / Knowledge RAG / Tool Call / Clarification / Handoff)
                  │
         ┌────────┴────────┐
         ▼                 ▼
[Static Knowledge RAG]  [Tool Executor & Business Rules]
(Vector DB + BM25)      (Atomic Lock, Live DB, Stock Check)
         │                 │
         └────────┬────────┘
                  │
                  ▼
[5. LLM Reasoning & Response Builder]
                  │
                  ▼
[6. Response Validator & Guardrails] ── (Cross-check facts & price vs DB snapshot)
                  │
                  ▼
[7. Egress & Event Bus] ── (Kafka/Redis Stream: order.created, inventory.updated)
```

---

## 🛡️ 3. Layer Keamanan & Keandalan Bisnis

### A. Dynamic vs Static Knowledge Separation
* **Static**: Deskripsi menu, bahan, alergen, FAQ, filosofi resto $\rightarrow$ Hybrid Search (Qdrant / PgVector + BM25).
* **Dynamic**: Stok realtime, ketersediaan meja, harga live, promo berjalan $\rightarrow$ Live Database & Redis cache via Deterministic Tools.

### B. Two-Phase Confirmation for Critical Actions
* Aksi dengan dampak finansial/operasional (Reservasi Meja, Pembuatan Order, Pembatalan) **wajib** melalui status `WAITING_CONFIRMATION` dengan ringkasan harga & data sebelum di-commit secara atomic ke database.

### C. Response Validation & Anti-Hallucination
* Sebelum respon dikirim ke customer, *Response Validator* melakukan ekstraksi matematis dan pengecekan silang terhadap snapshot database (mencegah salah sebut harga atau mengklaim menu yang sudah *sold out*).

### D. Concurrency & Out-of-Order Recovery
* Penggunaan *Distributed Lock (Redlock)* berbasis `conversation_id` dan antrean prioritas pesan untuk menangani pelanggan yang mengetik beberapa pesan dalam rentang milidetik.

---

## 🗺️ 4. Roadmap Implementasi Komponen Teknis

| Layer / Komponen | Modul Teknis | Status & Target |
| :--- | :--- | :--- |
| **Ingress & State** | Gateway Handler + Conversation FSM | Terintegrasi & Siap Ekspansi |
| **Tool Registry** | Strict JSON Schema Tools + Business Rules | Terintegrasi di `lib/ai-tools.ts` |
| **Context & Memory** | Multi-Tier Session Memory + Token Budget | Siap Dioptimasi |
| **Validation Layer** | Grounding Checker & Safety Filter | Siap Ditambahkan |
| **Event Bus & Sync** | Realtime Invalidation & PubSub | Siap Diintegrasikan |
