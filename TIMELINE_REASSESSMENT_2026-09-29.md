# Reassessment Timeline — AI-Powered Restaurant SaaS

**Tanggal assessment:** 29 September 2026  
**Baseline period:** 3 Agustus 2026 – 4 Januari 2027 (grid sumber memiliki M23 sampai 10 Januari 2027)  
**Current checkpoint:** awal M9 (28 September – 4 Oktober 2026), atau sekitar 8 minggu / 2–3 bulan berjalan  
**Sumber baseline utama:** `Ridho-Magang-Timeline (1) (1) - Timeline (2).csv`  
**Sumber actual:** Git history, source code, test scripts, dokumen progress, dan artefak timeline pendamping di repository.

> Catatan interpretasi: frasa “23 bulan” diasumsikan berarti “2–3 bulan”, karena proyek dimulai 3 Agustus 2026 dan assessment dilakukan 29 September 2026. CSV menyimpan 74 nama aktivitas tetapi tidak menyimpan warna/marking minggu. Alokasi minggu direkonstruksi dari workbook/timeline pendamping: M1–M6 dari laporan harian/workbook dan M7–M23 dari `timeline-m7-m23.csv`. Timeline awal tidak dihapus atau ditimpa.

## Ringkasan Eksekutif

- **30 dari 74 aktivitas sudah memiliki implementasi lengkap:** 11 selesai sesuai rencana dan 19 selesai dengan perubahan/scope tambahan.
- **22 aktivitas masih parsial**, **18 belum dimulai**, **1 sudah diganti sehingga tidak relevan**, dan **3 aktivitas presentasi belum dapat diverifikasi hanya dari repository**.
- Core MVP berkembang lebih cepat dan lebih luas dari baseline: PostgreSQL, Midtrans, Redis lease, Orama, Vercel AI SDK streaming, dua tenant, admin auth, customer self-service, dan isolasi data sudah tersedia.
- Deviasi terbesar bukan kekurangan fitur inti, melainkan **scope expansion**. Pekerjaan yang semula prototipe berubah menjadi hardening SaaS multi-tenant dan mengambil kapasitas dari memory, guardrail test suite, evaluation runner, load test, dan dokumentasi akhir.
- **Timeline awal tidak feasible bila seluruh scope dipertahankan utuh sampai akhir periode.** Timeline menjadi feasible bila final target dikunci pada dua tenant, alur reservasi + takeaway/payment yang sudah ada, security/testing, evaluasi, deployment verification, dan handoff.
- Verifikasi statis saat assessment: `npx tsc --noEmit --incremental false` **lulus tanpa error**. Build dan smoke test 7/7 tercatat di `PROGRESS.md`, tetapi tidak dijalankan ulang karena assessment ini tidak boleh mengubah state/file project atau database.

## Legenda Status

| Kode | Status | Arti |
|---|---|---|
| ✅ | Selesai sesuai rencana | Output utama tersedia tanpa perubahan material. |
| 🔄 | Selesai dengan perubahan | Output tersedia, tetapi teknologi, alur, waktu, atau scope berubah/bertambah. |
| 🟡 | Sebagian selesai | Ada implementasi/dokumen, tetapi definition of done baseline belum terpenuhi. |
| ⬜ | Belum dimulai | Tidak ditemukan implementasi yang cukup di repository. |
| 🗑️ | Diganti/tidak relevan | Pendekatan baseline sudah digantikan keputusan teknis yang lebih relevan. |
| ❓ | Belum terverifikasi | Aktivitas mungkin terjadi di luar repo, tetapi bukti yang tersedia belum cukup. |

## 1. Baseline Timeline (Timeline Awal)

Baseline berikut dipertahankan sebagai pembanding. Nama lengkap seluruh aktivitas terdapat pada tabel Actual Progress.

| Minggu | Tanggal | Aktivitas baseline |
|---|---|---|
| M1 | 3–9 Agu | #1 |
| M2 | 10–16 Agu | #2–#6 |
| M3 | 17–23 Agu | #7–#11 |
| M4 | 24–30 Agu | #12–#16 |
| M5 | 31 Agu–6 Sep | #17–#21 |
| M6 | 7–13 Sep | #22–#23 |
| M7 | 14–20 Sep | #24–#26 |
| M8 | 21–27 Sep | #27–#29 |
| M9 | 28 Sep–4 Okt | #30–#32 |
| M10 | 5–11 Okt | #33–#35 |
| M11 | 12–18 Okt | #36–#38 |
| M12 | 19–25 Okt | #39–#41 |
| M13 | 26 Okt–1 Nov | #42–#44 |
| M14 | 2–8 Nov | #45–#47 |
| M15 | 9–15 Nov | #48–#50 |
| M16 | 16–22 Nov | #51–#53 |
| M17 | 23–29 Nov | #54–#56 |
| M18 | 30 Nov–6 Des | #57–#59 |
| M19 | 7–13 Des | #60–#62 |
| M20 | 14–20 Des | #63–#65 |
| M21 | 21–27 Des | #66–#68 |
| M22 | 28 Des–3 Jan | #69–#71 |
| M23 | 4–10 Jan | #72–#74 |

## 2. Actual Progress dan Gap/Deviation per Aktivitas

### A. Discovery, MVP, dan AI Foundation (#1–#23)

| No. | Baseline activity | Status | Actual progress dan bukti | Gap/deviation dan keputusan |
|---:|---|:---:|---|---|
| 1 | Analisis kebutuhan dan perumusan konsep AI-Powered Restaurant SaaS | ✅ | Tercakup pada `PRD.md`, `insight.md`, dan dokumen arsitektur. | Tidak ada gap material. |
| 2 | Eksplorasi tools AI, agent, dan opsi model untuk chatbot restoran | ✅ | Ada riset model dan eksperimen Gemini/AI SDK pada `docs/research/` dan `scratch/`. | Tetap dijadikan input evaluasi, bukan deliverable baru. |
| 3 | Perancangan arsitektur awal sistem AI Restaurant serta pemilihan technology stack | 🔄 | `AI-architecture.md`, blueprint, production review gate, serta boundary AI/domain/infrastructure tersedia. | Scope bertambah dari arsitektur awal menjadi production architecture. |
| 4 | Penyusunan roadmap pengembangan AI-Powered Restaurant berbasis SaaS | ✅ | `ROADMAP.md` tersedia. | Roadmap perlu diselaraskan dengan reassessment ini, tetapi baseline tetap dipertahankan. |
| 5 | Riset dan evaluasi model AI serta infrastruktur chatbot | 🟡 | `llm_model_comparison.md` tersedia dan model aktif sudah dipilih. | Angka latency/cost/accuracy belum terbukti oleh benchmark reproducible; gabungkan dengan evaluasi M18. |
| 6 | Sinkronisasi visi asisten AI F&B dan roadmap multi-tenant | 🔄 | Visi sudah diwujudkan menjadi dua tenant dan tenant-aware AI/data flow. | Scope berkembang dari visi menjadi implementasi nyata. |
| 7 | Setup project structure dan initial development environment | ✅ | Next.js/TypeScript/Tailwind structure dan dependency tersedia sejak initial commit. | Tidak ada gap material. |
| 8 | Landing page utama dan Navbar | 🔄 | Landing page dan Navbar selesai lalu direfaktor menjadi storefront tenant-aware. | Scope bertambah: dynamic route, branding, dan tenant context. |
| 9 | Katalog menu dan manajemen data menu | 🔄 | Menu UI, PostgreSQL repository, admin toggle, dan Orama search tersedia. | Berubah dari mock/client state menjadi PostgreSQL + search index. |
| 10 | Form reservasi dan state management | 🔄 | Form, API create/availability/manage, tracking ticket, token, dan tenant-aware state tersedia. | Scope bertambah ke self-service cancel/reschedule dan privacy check. |
| 11 | Perencanaan scope, target MVP, dan roadmap | ✅ | PRD dan roadmap mendefinisikan MVP serta sasaran SaaS. | Definition of done perlu dikunci ulang sesuai revised scope. |
| 12 | Admin Dashboard untuk reservasi dan meja | 🔄 | Dashboard, reservation lifecycle, table status, tenant switch, dan signed admin session tersedia. | Scope bertambah ke auth dan multi-tenant isolation. |
| 13 | Penyelesaian Admin Dashboard, POS, payment flow, dan initial commit | 🔄 | Admin/POS-style actions dan payment flow tersedia; order items masih melekat pada reservation. | Selesai untuk MVP, tetapi belum menjadi domain Order/Cart terpisah. |
| 14 | Fondasi AI: types, conversation FSM, dan context engine | ✅ | `lib/ai/types.ts`, `state-machine.ts`, dan `context-engine.ts` tersedia. | Tidak ada gap utama pada fondasi. |
| 15 | AI orchestration, model, tool registry, dan Mock API | 🔄 | Orchestrator, Gemini client, tools, executor, schemas, streaming tersedia; mock telah diganti PostgreSQL. | Perubahan positif: mock API tidak lagi menjadi source of truth. |
| 16 | Presentasi progres arsitektur AI, scope, dan implementasi | ✅ | Presentasi telah disampaikan kepada mentor dan berjalan lancar, dan mendapatkan feedback yang positif
| 17 | Integrasi beberapa pilihan model AI melalui 9router | 🗑️ | Eksperimen/riset 9router pernah ada, tetapi current path memakai SDK resmi/provider-compatible flow. | Tidak perlu dihidupkan kembali; model router ditunda sampai ada kebutuhan terukur. |
| 18 | Temporary table lock, anti-double booking, dan jam operasional | 🔄 | Redis lease, transaksi/locking repository, overlap check, unique index, dan DB trigger tersedia. | Scope bertambah menjadi defense-in-depth; perlu load test concurrency. |
| 19 | Monitoring AI di Admin Dashboard dan test reservasi | 🔄 | Monitoring tab, orchestration tests, trace primitives, dan scenario scripts tersedia. | Monitoring/tracing masih in-memory dan belum menjadi production metrics store. |
| 20 | Optimasi performa chat, widget, dan loading | 🟡 | Streaming, loading UX, action buttons, dan refactor widget tersedia. | Belum ada benchmark P50/P95 yang membuktikan optimasi. |
| 21 | Presentasi progres minggu ke-4 dan evaluasi chatbot | ✅ | Presentasi telah disampaikan kepada mentor dan berjalan lancar, dan mendapatkan feedback yang positif
| 22 | Optimasi takeaway via AI hingga checkout | 🔄 | `calculate_order_total`, `create_takeaway_order`, Orama lookup, dan payment flow tersedia. | Implementasi menggunakan reservation/orderItems sebagai MVP, bukan cart domain mandiri. |
| 23 | Tombol pembayaran cepat dan pop-up pembayaran di AI Chat | 🔄 | Action button/payment CTA dan integrasi Midtrans Snap tersedia. | Scope bertambah ke webhook integrity dan PostgreSQL update. |

### B. Database, Tooling, dan Multi-Tenancy (#24–#41)

| No. | Baseline activity | Status | Actual progress dan bukti | Gap/deviation dan keputusan |
|---:|---|:---:|---|---|
| 24 | Validasi input menggunakan Zod pada AI tools | ✅ | `lib/ai/tool-schemas.ts` dan test schema tersedia. | Tidak ada gap utama. |
| 25 | Vercel AI SDK untuk tool calling, streaming, dan percakapan | ✅ | Vercel AI SDK tools dan SSE streaming digunakan pada current flow. | Tidak ada gap utama; tetap butuh E2E regression. |
| 26 | Prisma Client, PostgreSQL, model, dan repository | ✅ | Prisma schema/client dan repository PostgreSQL tenant-aware tersedia. | Tidak ada gap utama pada MVP. |
| 27 | Orama search dan typo-tolerant menu search | ✅ | `lib/search/orama-menu-index.ts` dan test Orama tersedia. | Verifikasi performa masuk M19. |
| 28 | Redis distributed table lease dan integration test | ✅ | `redis-lease-manager.ts` dan test integration tersedia. | Perlu validasi environment deployment dan failure mode Redis. |
| 29 | Hubungkan Admin Dashboard & POS ke PostgreSQL | 🔄 | Admin data/action routes dan hook UI sekarang server-authoritative; fallback mock dihapus. | Scope bertambah ke admin auth dan tenant claim. |
| 30 | Sambungkan Midtrans Webhook ke PostgreSQL | 🔄 | Webhook melakukan signature/amount validation dan update DB. | Sandbox code selesai; callback nyata via public HTTPS belum terverifikasi. |
| 31 | Fondasi Multi-Tenancy | 🔄 | Dua tenant, dynamic storefront, signed admin tenant session, scoped repository, DB trigger, dan draft RLS tersedia. | Selesai lebih awal dan scope bertambah; RLS belum aktif untuk app role. |
| 32 | Riset perbandingan performa model (latency, cost, accuracy) | 🟡 | Dokumen komparasi tersedia. | Benchmark 50 kasus yang reproducible belum ada; bergeser ke M18. |
| 33 | Short-Term Session Memory dengan sliding window | 🟡 | Sliding-window token budget ada pada `ContextEngine`. | Session/history masih dikirim client; belum durable/server-authoritative. Selesaikan versi minimum M10–M11. |
| 34 | Entity Extraction & Slot Filling untuk reservasi | 🟡 | Structured tool parameters dan pending action sudah menangkap slot reservasi. | Belum ada slot state yang eksplisit/persisten dan test multi-turn lengkap. |
| 35 | Conversation Summary Service | 🟡 | Helper `summarizeHistory()` dan `contextSummary` type tersedia. | Helper belum dipanggil/di-persist; jadikan deterministic summary minimum, bukan service baru. |
| 36 | Customer Profile Service | 🟡 | Tabel Customer menyimpan tenant, nama, telepon, jumlah reservasi, dan last visit. | Belum ada service/API profile lengkap atau preference fields yang persisten. |
| 37 | Long-Term Memory preferensi lintas sesi | ⬜ | Hanya ada type/prompt placeholder; Prisma belum menyimpan preferences. | Defer di luar periode kecuali ada permintaan stakeholder eksplisit. |
| 38 | API Customer Management di Admin Dashboard | ⬜ | Tidak ditemukan route/tab customer management khusus. | Defer; riwayat reservasi cukup untuk final MVP. |
| 39 | Setup Tenant B — Kopi Nusantara | 🔄 | Seed, branding, storefront, persona, menu, meja, dan reservations tenant B tersedia. | Selesai lebih awal dari baseline M12. |
| 40 | Pengujian isolasi data antar tenant | 🔄 | Smoke tests, tenant-scoped repository, signed claims, FK trigger, dan slot isolation script tersedia. | Selesai lebih awal; RLS masih draft dan smoke test perlu dijadikan repeatable gate. |
| 41 | Presentasi Bulan 3 — demo 2 tenant dengan AI memory | ❓ | Demo dua tenant memungkinkan, tetapi memory belum lengkap dan bukti presentasi belum ada. | Ubah demo menjadi dua tenant + short-term context; jadwalkan M12. |

### C. Security, White-Label, Ordering, dan Evaluation (#42–#59)

| No. | Baseline activity | Status | Actual progress dan bukti | Gap/deviation dan keputusan |
|---:|---|:---:|---|---|
| 42 | Input Sanitization & System Prompt Hardening | 🟡 | Zod boundary dan system instructions tersedia. | Belum ada sanitization/normalization khusus atau prompt-injection test gate. |
| 43 | Output Verification untuk mencegah data leak | 🟡 | `ResponseValidator` mengecek false-success, format harga, dan pola kartu. | Belum memeriksa tenant/internal fields secara lengkap dan belum jelas diterapkan pada streaming path. |
| 44 | Rate Limiting per Session/IP | 🟡 | Rate limit ada pada reservation create/availability/lookup/manage. | Chat endpoint/token budget belum dilindungi; in-memory limiter tidak lintas instance. |
| 45 | Red-Team Attack Suite 30+ skenario | ⬜ | Baseline audit mendokumentasikan 10 security cases, tetapi automated 30+ attack suite belum ada. | Wajib untuk M14; gunakan deterministic assertions lebih dulu. |
| 46 | Guardrail Service — domain boundary | ⬜ | Ada prompt rules dan validator dasar, tetapi tidak ada guardrail service/domain classifier yang utuh. | Implementasi minimum saja; tidak perlu service/abstraction besar. |
| 47 | E2E guardrails dan dokumentasi security | ⬜ | Belum ada test/report guardrail end-to-end yang memenuhi baseline. | Jadikan exit gate M14. |
| 48 | Dynamic System Prompt per Tenant | 🔄 | Prompt mengambil profile/menu tenant dari PostgreSQL dan branding/persona tenant-aware. | Selesai lebih awal; admin-editable prompt tidak diperlukan untuk MVP final. |
| 49 | Tenant White-Labeling | 🟡 | Dua theme, copy, route, dan branding tenant tersedia. | Upload logo/theme editor admin belum ada; defer konfigurator visual. |
| 50 | Custom Business Rules per Tenant | 🟡 | Jam buka/profile/policy dan reservation validation tenant-aware tersedia. | Rules belum configurable lengkap via admin; batasi pada DB fields yang sudah ada. |
| 51 | Setup Tenant C — Fine Dining | ⬜ | Tidak ditemukan tenant ketiga. | Defer di luar periode; tenant kedua sudah cukup membuktikan isolation/white-label. |
| 52 | Integration testing 3 tenant | ⬜ | Test baru mencakup dua tenant. | Ubah menjadi matrix test dua tenant. |
| 53 | Presentasi Bulan 4 — demo 3 tenant dengan guardrails | ⬜ | Belum tersedia. | Ubah menjadi demo dua tenant + security evidence. |
| 54 | Order & Cart API backend | 🟡 | Takeaway/order items dan total tersimpan melalui reservation repository. | Tidak ada Order/Cart domain/API CRUD mandiri; harden alur existing, jangan membangun ulang domain baru sekarang. |
| 55 | Tool dietary search, order cart, dan calculate bill | 🟡 | `calculate_order_total` dan `create_takeaway_order` menggantikan sebagian kebutuhan. | `search_menu_by_dietary` dan generic cart belum ada; tambahkan hanya filter minimal bila data mendukung. |
| 56 | Pre-Order Menu terhubung reservasi | ⬜ | Admin dapat menambah order items, tetapi flow pre-order saat booking belum ada. | Defer agar reservation/payment path tidak terganggu. |
| 57 | Evaluation Dataset 100 skenario | 🟡 | Dataset baseline berisi 50 skenario. | Tambah 50 kasus terarah pada M18, bukan membuat dataset baru dari nol. |
| 58 | Automated Test Runner dengan LLM-as-a-Judge | ⬜ | Belum ditemukan runner/judge report. | Gunakan deterministic test runner sebagai wajib; LLM judge opsional bila waktu/API budget cukup. |
| 59 | Baseline metrics dan laporan komparasi | 🟡 | Ada baseline audit kualitatif dan model comparison. | Belum ada run report dengan metrik groundedness/tool accuracy/hallucination/latency. |

### D. Performance, Reliability, dan Finalization (#60–#74)

| No. | Baseline activity | Status | Actual progress dan bukti | Gap/deviation dan keputusan |
|---:|---|:---:|---|---|
| 60 | Optimasi latency: parallel retrieval, cache, pooling | 🟡 | Runtime data memakai `Promise.all`, Orama cache, dan Prisma client. | Belum dibuktikan dengan profiling; optimasi hanya setelah M19 menemukan bottleneck. |
| 61 | Response Streaming real-time | 🔄 | SSE streaming melalui Vercel AI SDK sudah tersedia lebih awal. | Tinggal regression test dan memastikan verified facts tidak salah di-stream. |
| 62 | Performance benchmark dan profiling bottleneck | ⬜ | Tidak ada report benchmark P50/P95/P99 current build. | Jadwalkan M19. |
| 63 | Observability: tracing, structured logs, metrics dashboard | 🟡 | Trace/span primitive ada dan dipakai orchestrator/tool executor. | Trace bersifat in-memory, tidak persisten, dan belum ada metrics dashboard. Ambil minimum viable observability. |
| 64 | Penguatan Audit Trail semua aksi AI/admin | 🟡 | PostgreSQL audit events dan admin audit tab tersedia. | Coverage belum membuktikan semua AI action; export CSV belum ada. |
| 65 | Error Recovery & Graceful Degradation | 🟡 | Ada error response/fallback dasar dan webhook retry semantics. | Belum ada retry policy/circuit breaker/failure matrix yang diuji. |
| 66 | Simulasi 50 concurrent booking | ⬜ | Smoke test memeriksa conflict, tetapi bukan 50 concurrent users. | Wajib M21 karena melindungi correctness transaksi. |
| 67 | Stress test AI response quality under load | ⬜ | Belum ada hasil load test kualitas/latency. | Jalankan setelah deterministic evaluation stabil. |
| 68 | Bug fixing, edge cases, dan hardening | 🟡 | Sudah berlangsung sepanjang commit dan uncommitted hardening. | Tetap menjadi buffer M21; bukan aktivitas yang bisa dianggap selesai sekali. |
| 69 | Final Evaluation Run — 100 skenario | ⬜ | Belum dilakukan pada engine final. | Jadwalkan M22 setelah freeze. |
| 70 | Dokumentasi teknis lengkap dan repository cleanup | 🟡 | Banyak dokumen arsitektur/progress tersedia. | README/deployment/config guide final dan cleanup belum lengkap. |
| 71 | Persiapan demo 3 tenant dan materi final | ⬜ | Belum ada paket demo final. | Ubah menjadi demo dua tenant, sesuai revised scope. |
| 72 | Demo live 3 tenant | ⬜ | Belum dilakukan. | Ubah menjadi live demo dua tenant + isolation/security proof. |
| 73 | Presentasi Final Laporan Magang | ⬜ | Belum waktunya/belum ada bukti. | Tetap di akhir periode. |
| 74 | Laporan Akhir dan handoff | ⬜ | Belum tersedia. | Tetap di akhir periode, mulai outline lebih awal pada M20. |

## 3. Ringkasan Gap/Deviation

### Distribusi status

| Status | Jumlah | Persentase |
|---|---:|---:|
| Selesai sesuai rencana | 11 | 14,9% |
| Selesai dengan perubahan/scope tambahan | 19 | 25,7% |
| Sebagian selesai | 22 | 29,7% |
| Belum dimulai | 18 | 24,3% |
| Diganti/tidak relevan | 1 | 1,4% |
| Belum terverifikasi | 3 | 4,1% |
| **Total** | **74** | **100%** |

### Aktivitas yang bergeser dari jadwal

- #27–#28 selesai sekitar M8, kurang lebih satu minggu setelah baseline M7.
- #30–#31 selesai/terbentuk pada M8–M9; #32 masih parsial pada awal M9.
- #33–#38 belum selesai penuh dan perlu digeser dari M10–M11 dengan scope lebih kecil.
- #39, #40, #48, dan #61 dikerjakan lebih awal dari baseline karena kebutuhan integrasi nyata.
- #42–#47 belum dikerjakan penuh, tetapi sebagian security boundary muncul lebih awal sebagai bagian dari multi-tenant hardening.
- #63–#65 sudah memiliki fondasi lebih awal, namun belum memenuhi definition of done production.

### Aktivitas yang scope-nya bertambah

1. **Reservasi:** dari state lokal menjadi API server-authoritative, PostgreSQL transaction, Redis lease, DB unique guard, self-service token, dan privacy verification.
2. **Admin:** dari dashboard operasional menjadi signed session, tenant switching, dan server-side authorization.
3. **AI:** dari chatbot/mock tools menjadi structured tool calling, streaming, grounded tenant data, action buttons, idempotency primitive, dan domain executor.
4. **Payment:** dari payment flow UI menjadi Midtrans Snap + signature/amount validation + webhook PostgreSQL.
5. **Multi-tenancy:** dari visi menjadi dua storefront dengan branding, persona, data isolation, trigger DB, dan draft RLS.
6. **Data source:** mock/in-memory store dihapus dari current path; PostgreSQL menjadi source of truth.

### Aktivitas yang berubah atau tidak lagi relevan

- #17 9router multi-model tidak lagi menjadi jalur utama. SDK resmi/current provider path lebih sederhana dan sudah berjalan.
- #54–#56 tidak perlu dibangun sebagai domain Order/Cart besar pada periode ini. Existing takeaway/order-items flow cukup untuk MVP, lalu di-hardening.
- #51–#53 tiga tenant tidak memberi pembuktian arsitektur yang jauh lebih kuat daripada dua tenant, tetapi menambah seed, UI, test matrix, dan demo burden.
- #37–#38 long-term preference memory/customer admin bukan dependency untuk reservasi, payment, isolation, atau final demo.
- #58 LLM-as-a-Judge tidak boleh menjadi blocking gate; deterministic assertions lebih murah dan lebih mudah diaudit.

## 4. Perubahan Scope/Requirement Selama Project

| Area | Scope awal | Kondisi aktual | Dampak timeline |
|---|---|---|---|
| Arsitektur | Prototype single restaurant | Multi-tenant SaaS dengan domain/infrastructure layers | Menambah refactor lintas frontend, API, AI, dan DB. |
| Source of truth | Mock/in-memory | PostgreSQL/Prisma tanpa mock fallback | Memerlukan migration, repository, async UI, dan integrity tests. |
| Reservasi | Form + state management | Atomic booking, Redis lease, DB constraint, self-service manage token | Menggeser memory/evaluation ke belakang. |
| AI | Chat + mock tools | Gemini/AI SDK, schemas, streaming, grounded tools | Menambah testing dan validation surface. |
| Pembayaran | UI/payment flow | Midtrans Sandbox, webhook signature/amount validation, DB state | Memerlukan public callback test/deployment verification. |
| Multi-tenant | Roadmap/vision | Dua tenant, dynamic storefront, branding, signed admin tenant context | Menghasilkan pekerjaan isolation/security lebih awal. |
| Security | Belum dominan | Admin auth, privacy lookup, rate limiting, tenant guards, DB trigger/RLS draft | Scope penting dan tidak boleh dipangkas. |
| Realtime | Monitoring/UI | SSE chat + dashboard polling | Event bus production/WebSocket belum diperlukan untuk MVP. |
| Quality | Manual scenario | 50-case dataset + smoke/test scripts | Belum menjadi repeatable final evaluation pipeline. |

## 5. Feasibility Timeline Awal

### Verdict

**Tidak feasible bila semua requirement awal dijalankan penuh tanpa perubahan.** Dari M10 sampai M23 tersisa sekitar 14 minggu. Baseline masih memuat memory lengkap, Customer Management, security suite, tenant ketiga, generic Order/Cart, pre-order, 100-case LLM judge, performance, observability, stress test, dokumentasi, serta final presentation. Beberapa di antaranya adalah epic, bukan aktivitas mingguan kecil.

**Feasible dengan revised scope** apabila kondisi berikut dipenuhi:

1. Final product dibatasi pada **dua tenant**.
2. Fokus domain tetap **reservasi + existing takeaway/payment**, bukan generic commerce platform.
3. Long-term preference memory, customer admin, Tenant C, dan pre-order dipindahkan ke post-period backlog.
4. Security, transaction correctness, evaluation, load test, deployment verification, dan handoff tidak dipangkas.
5. Setiap minggu memiliki exit criteria; pekerjaan baru tidak masuk tanpa mengganti scope lain.
6. M22 menjadi code freeze. M23 hanya demo, laporan, dan handoff.

## 6. Revised Timeline untuk Sisa Periode

### Prinsip revised timeline

- Melanjutkan hasil yang sudah ada; tidak membangun ulang dari nol.
- Menutup correctness/security gap sebelum menambah fitur.
- Menggunakan implementasi minimum yang dapat diuji; tidak membuat service baru bila helper/module existing cukup.
- Aktivitas presentasi dan dokumentasi memiliki bukti output yang jelas.

| Minggu | Tanggal | Revised focus dan baseline terkait | Definition of done | Alasan perubahan |
|---|---|---|---|---|
| **M9 (current)** | 28 Sep–4 Okt | Reassessment, freeze scope, validasi current branch; tutup #30–#32 | Typecheck/build gate tercatat, smoke suite terdokumentasi, keputusan scope disetujui, backlog diberi owner/status | M9 tidak boleh diisi fitur baru sebelum perubahan besar multi-tenant distabilkan. |
| **M10** | 5–11 Okt | Stabilization + short-term session minimum (#33) | Session/history tidak dipercaya mentah dari client; sliding window memiliki test; regression reservation/payment lulus | Memory perlu fondasi aman sebelum summary/profile. |
| **M11** | 12–18 Okt | Slot filling + summary minimum (#34–#35), profile read model minimum (#36) | Multi-turn reservation mempertahankan slot; summary benar-benar dipakai; profile hanya nama/telepon/history | Menggabungkan tiga aktivitas menjadi satu vertical slice kecil. |
| **M12** | 19–25 Okt | Tenant B/isolation regression dan demo 2 tenant (#39–#41) | Repeatable isolation suite, demo script, hasil/feedback mentor tercatat | #39–#40 sudah lebih awal; waktu dipakai untuk bukti dan penutupan, bukan membangun Tenant C. |
| **M13** | 26 Okt–1 Nov | Input/output/rate-limit hardening (#42–#44) | Chat input limit, output leak/false-success checks pada streaming dan non-streaming, rate-limit policy teruji | Menutup trust-boundary gap sebelum red-team. |
| **M14** | 2–8 Nov | Red-team + minimal guardrails (#45–#47) | ≥30 automated attack cases, domain refusal, cross-tenant/prompt leak tests, security report | Security wajib; implementasi minimum lebih penting daripada service besar. |
| **M15** | 9–15 Nov | Polish dynamic prompt, white-label, tenant rules (#48–#50) | Dua tenant memiliki prompt/theme/rules konsisten dan matrix test lulus | #48 sudah ada; #49–#50 dibatasi pada config/DB fields existing. |
| **M16** | 16–22 Nov | Integration gate dua tenant; pengganti #51–#53 | E2E matrix dua tenant, demo guardrails, bug list ditutup/ditriage | Tenant C dihapus agar waktu digunakan untuk kualitas dua tenant. |
| **M17** | 23–29 Nov | Harden existing takeaway/order/payment (#54–#55); #56 deferred | Total deterministic, item/quantity/payment integrity test, real Midtrans Sandbox callback via public HTTPS bila environment tersedia | Menguatkan flow existing lebih aman daripada membangun generic Cart API dan pre-order baru. |
| **M18** | 30 Nov–6 Des | Evaluation dataset + runner + baseline report (#57–#59) | Dataset menjadi 100 kasus, deterministic runner menghasilkan report; LLM judge opsional | Memenuhi bukti kuantitatif tanpa membuat LLM judge sebagai dependency. |
| **M19** | 7–13 Des | Performance profiling dan streaming regression (#60–#62) | P50/P95 tercatat, bottleneck diidentifikasi, hanya bottleneck terbukti yang dioptimasi | #61 sudah ada; fokus bergeser dari feature build ke measurement. |
| **M20** | 14–20 Des | Minimum observability, audit coverage, failure recovery (#63–#65) | Structured request/tenant/conversation IDs, audit coverage mutating actions, failure matrix dan fallback tests | Hindari metrics platform besar; cukup observability yang dapat dipakai saat demo/incident. |
| **M21** | 21–27 Des | Concurrency/load/bug hardening (#66–#68) | 50 concurrent booking: tepat satu pemenang per slot; AI load result tercatat; critical bugs nol | Transaction correctness adalah release gate, bukan nice-to-have. |
| **M22** | 28 Des–3 Jan | Final evaluation, documentation, demo prep (#69–#71) | 100-case final report, README/setup/deployment/known issues, demo/video backup; code freeze | Semua evidence disiapkan sebelum hari final. |
| **M23** | 4–10 Jan* | Demo, final presentation, report/handoff (#72–#74) | Demo dua tenant, presentasi, laporan akhir, env/deployment/handoff checklist | Aktivitas final saja; tidak ada feature work. |

\* Dokumen baseline menyebut akhir periode 4 Januari 2027, sedangkan header M23 mencakup 4–10 Januari. Jika **4 Januari adalah hard deadline**, seluruh materi M23 harus selesai di M22 dan 4 Januari hanya digunakan untuk presentasi/handoff.

## 7. Scope yang Dipindahkan ke Post-Period Backlog

| Baseline | Scope yang ditunda/diganti | Alasan |
|---|---|---|
| #17 | Multi-model routing/9router | Tidak ada kebutuhan terukur; current provider path sudah cukup. |
| #37 | Long-term preference memory | Bukan dependency core flow dan menambah PII/data lifecycle risk. |
| #38 | Customer Management admin | Riwayat reservasi existing cukup untuk final MVP. |
| #49 | Admin upload/logo/theme editor | Code/config-based white-label sudah membuktikan capability. |
| #50 | Full admin-configurable rules engine | DB fields/rules existing cukup; rules engine berisiko over-engineering. |
| #51–#53 | Tenant C dan demo tiga tenant | Dua tenant sudah membuktikan isolation dan branding dengan biaya test lebih rendah. |
| #54 | Generic Order/Cart CRUD domain | Existing takeaway flow memenuhi use case demo; domain baru berisiko mengganggu stabilitas. |
| #55 | Tool `create_order_cart` penuh | Digantikan `calculate_order_total` + `create_takeaway_order`; dietary filter hanya bila data tersedia. |
| #56 | Pre-order terhubung reservasi | Fitur baru non-kritis menjelang hardening/final evaluation. |
| #58 | LLM-as-a-Judge sebagai requirement wajib | Mahal/non-deterministik; deterministic runner menjadi release gate, judge tetap opsional. |
| #63 | Full metrics dashboard/platform | Structured logs + trace/audit minimum cukup untuk periode ini. |

## 8. Alasan Setiap Perubahan Timeline

1. **#30–#31 ditutup lebih awal:** implementasi PostgreSQL/Midtrans/multi-tenancy sudah mendahului baseline; waktu M9 dialihkan ke stabilization.
2. **#32 bergeser ke M18:** riset dokumen sudah ada, tetapi benchmark harus dilakukan bersama dataset/runner agar angka dapat direproduksi.
3. **#33–#36 dipadatkan ke M10–M11:** gunakan current ContextEngine, session type, dan Customer table; tidak perlu empat service baru.
4. **#37–#38 ditunda:** personalization/customer admin tidak menghambat reservasi, payment, isolation, atau demo.
5. **#39–#41 difokuskan pada bukti:** Tenant B dan isolation sudah tersedia; sisa pekerjaan adalah test repeatability dan demo evidence.
6. **#42–#47 tetap diprioritaskan:** security boundary tidak boleh disederhanakan; pengerjaan dipisah antara hardening dan red-team agar hasil dapat diuji.
7. **#48–#50 dipersempit:** dynamic prompt sudah ada; white-label dan rules cukup memakai konfigurasi/DB fields saat ini.
8. **#51–#53 diganti dua tenant:** tenant ketiga menambah data, UI, QA, dan demo tetapi tidak menambah bukti arsitektur yang sebanding.
9. **#54–#56 dipersempit:** current takeaway/payment flow di-hardening; generic cart dan pre-order ditunda untuk menghindari domain rewrite.
10. **#57–#59 tetap M18:** evaluasi kuantitatif penting untuk laporan akhir; dataset existing 50 kasus menjadi titik awal.
11. **#60–#62 tetap setelah evaluation:** optimasi dilakukan dari hasil profiling, bukan asumsi.
12. **#63–#65 memakai versi minimum:** persistence/metrics platform besar ditunda, tetapi IDs, structured logging, audit, dan failure behavior wajib.
13. **#66–#68 dipertahankan:** concurrency dan load test adalah bukti bahwa anti-double-booking benar di kondisi nyata.
14. **#69–#74 dilindungi dari feature creep:** M22 code freeze; M23 tidak menerima fitur baru.

## 9. Release Gates dan Risiko

| Gate | Harus lulus sebelum lanjut | Risiko bila gagal |
|---|---|---|
| G1 — Current stability | Typecheck/build + regression core flow | Revised timeline dimulai di atas branch yang tidak stabil. |
| G2 — Security | 30+ red-team cases dan tenant isolation | Data leak/prompt abuse saat demo atau deployment. |
| G3 — Transaction correctness | Concurrent booking dan payment integrity | Double booking atau status pembayaran salah. |
| G4 — Evaluation | 100-case deterministic report | Klaim improvement tidak dapat dibuktikan. |
| G5 — Handoff | Setup/deploy/known issues/demo docs | Project sulit dilanjutkan setelah periode magang. |

Risiko terbesar saat ini adalah uncommitted working tree yang besar, RLS yang masih draft, session chat yang client-carried, output validator yang belum lengkap pada streaming, in-memory rate limit/trace/idempotency, serta belum adanya benchmark/load report final. Risiko ini sudah ditempatkan sebelum code freeze pada revised timeline.

## 10. Sumber Bukti Utama

- Baseline activity inventory: `Ridho-Magang-Timeline (1) (1) - Timeline (2).csv`
- Planned M7–M23 details: `timeline-m7-m23.csv`
- Daily actual reports: `progress-harian-15-28-agustus.csv` dan `.txt`
- Current implementation summary: `PROGRESS.md`
- Git history: commit 20 Agustus–25 September 2026 dan current uncommitted working tree
- Core AI: `lib/ai/`, `lib/domain/`, `lib/infrastructure/`
- Database: `prisma/schema.prisma`, `lib/db/prisma-repository.ts`, `prisma/sql/`
- Public/admin APIs: `app/api/`
- Multi-tenant UI: `app/t/[slug]/`, `components/Storefront.tsx`, `lib/tenants.ts`
- Tests/evaluation: `scratch/test-*.ts`, `scratch/smoke-test.mjs`, `docs/benchmarks/`

---

**Kesimpulan akhir:** project tidak perlu diulang atau dibuatkan timeline baru dari nol. Baseline tetap dipakai, actual progress menunjukkan core system sudah berkembang jauh, dan sisa periode paling masuk akal digunakan untuk menutup security/correctness/evaluation/deployment/documentation gap. Dengan scope dua tenant dan existing reservation/takeaway flow, target akhir masih feasible.
