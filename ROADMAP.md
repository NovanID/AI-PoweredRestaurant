# 🗺️ 6-Month Roadmap & Engineering Plan: AI-Powered Restaurant SaaS

> **Status:** Active Roadmap & Engineering Specification  
> **Periode:** Agustus 2026 – Januari 2027 (6 Bulan)  
> **Owner:** Vanny (NovanID)  
> **Target:** Multi-Tenant Restaurant AI SaaS with Controlled Tool Calling & Measurable Benchmarks

---

## 📌 1. Executive Summary & Visi Produk

Proyek magang ini mentransformasikan prototipe chatbot satu restoran menjadi **Multi-Tenant AI-Powered Restaurant SaaS**. Platform ini memungkinkan berbagai jenis restoran (Restoran Padang, Cafe, Fine Dining, dll.) memiliki asisten AI cerdas untuk melayani informasi menu, ketersediaan meja, reservasi instan, dan pemesanan dengan karakteristik brand masing-masing.

### Prinsip Utama Rekayasa:
1. **Research-Backed Architecture:** Setiap implementasi teknis didasari oleh riset komparatif, best practice industri, dan trade-off yang terukur.
2. **Deterministic Business Operations:** AI tidak menebak fakta, harga, ataupun availability. Seluruh operasi bisnis dieksekusi melalui **Strict Tool Calling** yang terhubung langsung ke database.
3. **Multi-Tenant Isolation by Design:** Keamanan data dan konfigurasi personalisasi antar restoran terisolasi ketat di level query dan API context.
4. **Measurable Performance:** Kualitas AI dan pencegahan "ngawur" didefinisikan dalam metrik kuantitatif (*Groundedness*, *Tool Accuracy*, *Latency*, dan *Cost*).

---

## 🎯 2. Definisi MVP (Minimum Viable Product)

* **Target Waktu Selesai:** **Akhir Bulan 2 (Minggu ke-8)**
* **Tujuan MVP:** Membuktikan vertical slice sistem multi-tenant berjalan end-to-end tanpa halusinasi, mampu menangani 2 tenant berbeda, dan mencegah double booking secara deterministik.

```text
+-----------------------------------------------------------------------------------+
|                              SCOPE MATRIKS PROYEK                                 |
+----------------------------------------------------+------------------------------+
| IN SCOPE (MVP - Bulan 1 s/d 2)                    | IN SCOPE (SaaS - Bulan 3-6)  |
+----------------------------------------------------+------------------------------+
| - Multi-tenant DB Schema (tenant_id isolated)      | - Dynamic Model Routing & LLM|
| - Admin Dashboard: Profile, Menu, Meja, Reservasi  | - Multi-tier Session Memory  |
| - Customer Web & AI Chat interface                | - Semantic Guardrails & WAF  |
| - Deterministic Tool Calling (Menu, Availability)  | - Evaluator Benchmark Suite  |
| - Atomic Slot Locking (Anti Double-Booking)        | - Multi-Brand Theming/White  |
| - 2 Tenant Demo (Restoran Padang & Restoran Cafe)  | - Online Ordering / Cart Flow|
+----------------------------------------------------+------------------------------+
| OUT OF SCOPE / DITUNDA (Bukan Fokus 6 Bulan)                                     |
+-----------------------------------------------------------------------------------+
| - Complex Autonomous Agent Swarms (tidak efisien biaya & sulit dikontrol)         |
| - Fine-Tuning LLM dari scratch (cukup prompt engineering + tool calling)          |
| - Multi-region distributed database clustering                                   |
| - Integrasi POS hardware proprietary restoran                                     |
+-----------------------------------------------------------------------------------+
```

---

## 🗓️ 3. Roadmap Bulanan (High-Level Milestones)

```text
AGUSTUS (M1)          SEPTEMBER (M2)         OKTOBER (M3)           NOVEMBER (M4)          DESEMBER (M5)          JANUARI (M6)
[Foundation & Res] ──> [MVP Release] ───────> [LLM Engine & Mem] ──> [Guardrails & Multi] ─> [Eval Benchmark] ───> [Hardening & Pilot]
 • Baseline Research    • Multi-Tenant DB      • Function Calling     • Prompt Injection Def  • Evaluator Pipeline   • Load & Stress Test
 • Baseline Eval        • Atomic Lock API      • Hybrid Model Route   • Tenant Isolation Def  • "Ngawur" Metrics     • Multi-Tenant Demo
 • Core Architecture    • 2-Tenant Test        • Session Cache DB     • Dynamic Brand Prompt  • Automated Testing    • Final Tech Report
```

---

## ⏱️ 4. Breakdown Rinci 2-Mingguan (Sprint 1 s/d Sprint 12)

### 🔹 BULAN 1: Research, Architecture Design & Baseline Benchmark ✅ *(COMPLETED)*
*Fokus: Meletakkan pondasi riset, mengukur kelemahan chatbot lama, dan mendesain arsitektur multi-tenant.*

* **Sprint 1 (Minggu 1–2): Research & Problem Framing** ✅
  * [x] Riset komparasi model LLM (Gemini 2.5 Flash vs GPT-4o-mini vs Llama 3.1 8B vs eliminasi Anthropic karena biaya) terkait latency, biaya per 1k token, dan reliabilitas function calling: [llm_model_comparison.md](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/docs/research/llm_model_comparison.md).
  * [x] Audit dan dokumentasi *baseline chatbot* lama: catat 30 contoh kegagalan (halusinasi harga, slot bentrok, jailbreak prompt): [baseline_chatbot_audit.md](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/docs/benchmarks/baseline_chatbot_audit.md).
  * [x] Menyusun *Evaluation Dataset Baseline* (50 sample skenario customer nyata): [evaluation_dataset_baseline.json](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/docs/benchmarks/evaluation_dataset_baseline.json).
  * **Deliverable Selesai:** Dokumen riset model LLM, dataset baseline 50 skenario, dan audit 30 kegagalan.

* **Sprint 2 (Minggu 3–4): Multi-Tenant Architecture & Data Modeling** ✅
  * [x] Desain database multi-tenant (PostgreSQL dengan `tenant_id` pada setiap tabel: `restaurants`, `tables`, `menu_items`, `reservations`, `audit_events`): [schema.sql](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/schema.sql) & [schema.prisma](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/prisma/schema.prisma).
  * [x] Desain interface API standar untuk Tools (Menu Reader, Availability Engine, Reservation Lifecycle) & Arsitektur Memori 4-Lapis: [ai_memory_knowledge_flow.md](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/docs/architecture/ai_memory_knowledge_flow.md).
  * [x] Dokumen Arsitektur Sistem Komprehensif: [system_architecture_blueprint.md](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/docs/architecture/system_architecture_blueprint.md).
  * **Deliverable Selesai:** Dokumen *System Architecture & Multi-Tenant Blueprint* + [schema.sql](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/schema.sql).

---

### 🔹 BULAN 2: Core Engine, Grounded Tools & MVP Delivery
*Fokus: Membangun backend engine, tool calling lokal, anti-double-booking, dan rilis MVP pertama.*

* **Sprint 3 (Minggu 5–6): Atomic Reservation Engine & Admin Dashboard**
  * Implementasi *Atomic Slot Locking* untuk reservasi (window waktu overlapping 90 menit) guna mencegah *race condition*.
  * Admin Portal per Tenant: pengelolaan menu, konfigurasi meja, jam operasional, dan live reservation view.
  * **Deliverable:** Admin Dashboard fungsional per tenant & reservasi anti-double booking.

* **Sprint 4 (Minggu 7–8): Customer Portal & Deterministic Tool Calling (🎯 MVP RELEASE)**
  * Menghubungkan Chatbot UI dengan REST API/Tools (`get_restaurant_info`, `get_menu`, `check_availability`, `create_reservation`, `get_reservation`, `cancel_reservation`).
  * Integrasi seed data 2 tenant berbeda (Tenant A: *Restoran Padang Raso Minang*, Tenant B: *Kopi Nusantara Cafe*).
  * **Deliverable:** **Rilis MVP V1 (Internal Demo & Review Pertama)**.

---

### 🔹 BULAN 3: LLM Integration, Dynamic Routing & Memory System
*Fokus: Mengintegrasikan LLM cloud riil, optimasi token/biaya, dan manajemen context/session.*

* **Sprint 5 (Minggu 9–10): Real LLM Function Calling & Model Router**
  * Integrasi SDK LLM resmi dengan Structured Function Calling / JSON schema enforcement.
  * Implementasi *Model Routing*: Query FAQ sederhana ditangani model cepat/murah (misal: Gemini 2.5 Flash / GPT-4o-mini), sedangkan booking kompleks dengan multi-turn disambungkan ke model dengan reasoning lebih tinggi.
  * **Deliverable:** Modul `ModelRouter` dan integrasi SDK LLM cloud.

* **Sprint 6 (Minggu 11–12): Context & Memory Layer**
  * Arsitektur *Short-Term Session Memory* (Redis / Database KV Session) dengan *Sliding Window Context* (membatasi riwayat pesan agar token tidak membengkak).
  * *Entity Extraction & Slot Filling*: AI menyimpan konteks (nama customer, jumlah orang, tanggal yang sedang dibicarakan) tanpa meminta ulang berulang kali.
  * **Deliverable:** Session & Context State Manager dengan slot filling.

---

### 🔹 BULAN 4: Guardrails, Security Shield & Tenant Personalization
*Fokus: Mengamankan sistem dari eksploitasi, kebocoran data antar restoran, dan personalisasi brand.*

* **Sprint 7 (Minggu 13–14): Guardrails & Prompt Injection Defense**
  * Input Sanitization & System Prompt Hardening: isolasi instruksi sistem dari input customer (*Delimiters & Defensive Prompting*).
  * Output Verification: Memastikan AI tidak pernah menampilkan `tenant_id` lain atau data internal database.
  * Rate Limiting per IP/Session untuk mencegah *Token Exhaustion Denial-of-Service*.
  * **Deliverable:** Security Layer & Input/Output Guardrails.

* **Sprint 8 (Minggu 15–16): Multi-Tenant Personalization Engine**
  * Dynamic System Prompt: AI secara otomatis mengadopsi persona (*tone of voice*, dialek keramahan, aturan diskon/kebijakan) sesuai konfigurasi tenant di database.
  * Tenant White-Labeling (Logo, warna tema, nama restoran, FAQ khusus).
  * **Deliverable:** Dynamic Personality Prompt Generator per Tenant.

---

### 🔹 BULAN 5: Ordering/Cart Flow, Evaluation Pipeline & "Definisi Ngawur" Benchmark
*Fokus: Menambah kapabilitas pemesanan makanan, mengukur performa AI secara matematis/kuantitatif.*

* **Sprint 9 (Minggu 17–18): Table Ordering & Pre-Order Flow**
  * AI Tool baru: `search_menu_by_dietary`, `create_order_cart`, `calculate_bill`.
  * Integrasi keranjang pesanan langsung ke detail reservasi meja.
  * **Deliverable:** Fitur Pre-Order Menu terintegrasi dengan reservasi.

* **Sprint 10 (Minggu 19–20): Automated Evaluation Framework (LLM-as-a-Judge)**
  * Pembangunan script automated testing menggunakan dataset uji (100 skenario edge cases).
  * Pengukuran metrik: *Groundedness*, *Tool Execution Accuracy*, *Hallucination Rate*, *Latency*, dan *Token Cost per Booking*.
  * **Deliverable:** **Laporan Komparasi Kuantitatif (Baseline Lama vs SaaS Engine Baru)**.

---

### 🔹 BULAN 6: Stress Testing, Multi-Restaurant Pilot & Final Internship Report
*Fokus: Hardening produksi, validasi pengguna/staf restoran, dan penulisan laporan teknis akhir.*

* **Sprint 11 (Minggu 21–22): Load Testing & Edge Case Hardening**
  * Simulasi 50 concurrent booking secara bersamaan (*Stress test double booking*).
  * Fallback mechanism: Penanganan graceful degradation saat provider LLM timeout/down (otomatis beralih ke rule-based dialog atau model backup).
  * **Deliverable:** Test report load testing & benchmark ketahanan sistem.

* **Sprint 12 (Minggu 23–24): Pilot Review & Final Deliverable**
  * Demo 3 tenant berbeda secara live end-to-end.
  * Penyusunan Dokumentasi Arsitektur, Repositori Bersih, dan Laporan Akhir Magang 6 Bulan.
  * **Deliverable:** Laporan Akhir Magang & Presentasi SaaS.

---

# 🔬 5. Enam (6) Research & Engineering Tracks

### 1. AI Model Selection & Token/Cost Optimization
* **Riset Pilihan Model:**
  * Primary Model: Lightweight fast LLM (Gemini 2.5 Flash / GPT-4o-mini) — Latency < 800ms, cost ~$0.15/1M token.
  * Heavy Model: Claude 3.5 Sonnet — Fallback untuk negosiasi multi-step complex.
  * Self-Hosted LLM: Llama 3.1 8B — Diteliti dalam laporan sebagai alternatif on-premise.
* **Strategi Efisiensi Token:**
  * Menu data tidak di-dump ke dalam system prompt; diambil secara dinamis via tool.
  * Konfigurasi parameter model: `temperature = 0.1` (fokus deterministik) dan `max_tokens = 500`.

### 2. Memory & Session Context Architecture
* **Short-Term Context:** Window 6 turn dialog terakhir disimpan dalam session store.
* **Slot Filling State:** Data reservasi (`date`, `time`, `guest_count`, `table_area`) diekstrak menjadi objek JSON state terstruktur.
* **Long-Term Memory:** Identifikasi pelanggan berbasis nomor telepon untuk mengingat riwayat reservasi tanpa mengorbankan privasi.

### 3. Tool Calling Architecture
* **Prinsip:** AI hanya membaca dan menyusun argumen JSON; eksekusi logika bisnis dijalankan oleh Backend API.
* **Daftar Core Tools:**
  * `get_restaurant_info()`
  * `get_menu(category?, search?)`
  * `check_availability(date, time, guestCount, area?)`
  * `create_reservation(payload)`
  * `get_reservation(code)`
  * `update_reservation(code, newDate?, newTime?, newGuests?)`
  * `cancel_reservation(code, reason?)`

### 4. Guardrails, Security & Safety
* **Prompt Injection Defense:** Penggunaan strict system tags `<user_message>` dan delimiter.
* **Cross-Tenant Data Isolation:** Parameter `tenant_id` disuntikkan oleh server context, bukan dipercayakan kepada output LLM.
* **Action Authorization:** Pembatalan dan pengubahan jadwal wajib mencocokkan nomor telepon / kode reservasi.
* **Rate Limiting:** Maksimal 15 pesan / 5 menit per session untuk mencegah token abuse.

### 5. Definisi "Ngawur" & Framework Evaluasi
"Ngawur" didefinisikan secara kuantitatif melalui 6 metrik:
1. **Groundedness Index (Target: 100%):** Kesesuaian fakta jawaban terhadap output tool.
2. **Tool Selection Accuracy (Target: ≥95%):** Ketepatan pemilihan tool dan parameter.
3. **Zero-Hallucination on Unavailable Data (Target: 100%):** Menyatakan "tidak tersedia" jika data tidak ada di DB.
4. **Double-Booking Prevention (Target: 100%):** Tidak ada slot bertabrakan yang lolos.
5. **Prompt Injection Resistance (Target: ≥98%):** Kebal terhadap jailbreak di luar domain restoran.
6. **P95 Response Latency (Target: < 1.5s):** Kecepatan respon optimal.

### 6. Multi-Tenant SaaS & Personalization
* **Tenant Schema:** Multi-tenant single database dengan `tenant_id` sebagai partition column.
* **Dynamic Personality:** Tone of voice (Formal, Casual, Minang-friendly) dimuat secara dinamis sesuai profil restoran di database.
* **Custom Business Rules:** Kebijakan durasi makan, batas waktu pembatalan, dan jam buka disesuaikan per tenant.

---

## 📊 6. Matriks Evaluasi: Baseline Chatbot vs AI SaaS Engine

| Parameter | Baseline Chatbot (Lama) | AI SaaS Engine Baru | Metode Pengukuran |
| :--- | :--- | :--- | :--- |
| **Akurasi Data Menu & Harga** | ~60% (Sering menebak jika tidak yakin) | **100% Grounded** (Data DB via Tool) | Automated LLM-as-a-Judge |
| **Pencegahan Double-Booking** | Gagal pada waktu bersamaan | **100% Atomic Lock Prevention** | Concurrent Load Test |
| **Ketahanan Prompt Injection** | Rentan diubah perannya | **Robust Defense** dengan System Delimiters | Red-Teaming Attack Suite |
| **Skalabilitas Tenant** | 1 Restoran Hardcoded | **Multi-Tenant SaaS** (N-Restoran) | Dynamic Context Testing |
| **Kecepatan Respon** | > 3.5 detik | **< 1.5 detik** (Flash Model + Tool) | APM Latency Metric |

---

## ✅ 7. Definition of Done Proyek 6 Bulan

- [ ] Arsitektur Multi-Tenant berjalan stabil untuk minimal 3 tenant restoran aktif.
- [ ] AI Assistant melayani FAQ, cek menu, ketersediaan meja, dan siklus reservasi dengan 100% grounded data.
- [ ] Mekanisme Atomic Slot Locking mencegah 100% percobaan double booking pada stress test.
- [ ] Tersedia Guardrails aktif untuk keamanan input, isolasi tenant, dan rate-limiting token.
- [ ] Tersedia suite evaluasi otomatis dengan laporan perbandingan kuantitatif terhadap baseline lama.
- [ ] Laporan teknis komprehensif 6 bulan selesai dan siap dipresentasikan.
