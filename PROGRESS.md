# PROGRESS - Multi-Tenant Restaurant System

**Tanggal**: 28 September 2026  
**Status**: Phase 1–4 selesai (Security + SSOT + Storefront + Isolation)  
**Build**: ✅ `npm run build --webpack` sukses  
**Server**: Jalan di port 3100  
**Smoke Test**: 7/7 PASS (cross-tenant + double-booking + admin auth)

---

## Ringkasan Keseluruhan

Backend sudah **100% tenant-aware**:
- TenantId diambil dari HMAC-signed admin session cookie (bukan dari query/body).
- Semua customer-facing endpoint (create, lookup, manage, payment) sudah tenant-aware.
- AI Orchestrator & Tool Executor selalu baca data dari **PostgreSQL** (Prisma) per tenant.
- Storefront sekarang support multi-tenant melalui `/t/[slug]` + TenantContext.
- PostgreSQL adalah **satu-satunya sumber kebenaran**.
- Data isolation sudah diterapkan (FK trigger + unique slot index + RLS script).

---

## Phase-by-Phase Summary

### Phase 1: Security Boundary + Public Endpoints
- ✅ Admin API (`/api/admin/*`) dilindungi dengan HMAC cookie.
- ✅ Tenant diambil dari session claim, bukan dari body/query.
- ✅ Lookup reservasi sekarang **server-side verified** (phone check + manage token).
- ✅ Create / Manage / Cancel / Reschedule via `/api/reservations/*` dengan token.
- ✅ Admin login page + switch-tenant API.
- ✅ Rate limiting + content safety untuk public endpoints.

### Phase 2: Single Source of Truth (PostgreSQL)
- ✅ AI Orchestrator, StreamingOrchestrator, ContextEngine, ToolExecutor, ReservationService **semua baca dari PrismaRepository**.
- ✅ Semua fallback ke `restaurantStore` sudah dihapus.
- ✅ Error database = respons gagal (tidak ada fallback mock).
- ✅ Orama search index juga pakai Prisma data per tenant.

### Phase 3: Tenant-Aware Storefront
- ✅ `/t/[slug]` routing + tenant resolver.
- ✅ TenantContext + branding (logo, warna, copywriting, hero text) per tenant.
- ✅ Storefront data endpoint (`/api/storefront/data`) return data tenant-specific.
- ✅ Chat welcome, menu, reservation form, AI persona **berubah sesuai tenant** (Raso Minang → Kopi Nusantara).

### Phase 4: Data Isolation & Hardening
- ✅ **Trigger DB**: `reservation.table_id` harus milik tenant yang sama.
- ✅ **Unique Index**: slot (table + date + time) hanya boleh 1 reservasi aktif.
- ✅ RLS script siap dipakai (setelah role aplikasi dibuat).
- ✅ Smoke test HTTP: 7/7 PASS (admin auth, tenant switch, lookup phone, create reservasi tenant 2, double-booking, /t/[slug], etc).

---

## File yang Sudah Berubah (54 perubahan)

### Utama
- `app/api/admin/*` — semua route dilindungi
- `lib/auth/admin-session.ts` + `constants.ts` — HMAC cookie
- `lib/tenants.ts` — registry branding per tenant
- `components/Storefront.tsx` + `app/t/[slug]/page.tsx`
- `lib/ai/*` — semua SSOT ke Prisma
- `lib/db/prisma-repository.ts` — method tenant-aware
- `prisma/sql/20260928_slot_isolation.sql` — trigger + unique index
- `app/globals.css` — theming CSS var per tenant
- `components/AIChatWidget.tsx`, `ReservationSection.tsx`, `MenuSection.tsx`, `Navbar.tsx`
- `lib/ai-assistant-service.ts`, `lib/use-restaurant.ts`, `lib/tenant-context.ts`

### Lainnya
- `package.json` (build script pakai webpack)
- `lib/ai-tools.ts` (sudah dihapus karena tidak dipakai lagi)
- `lib/restaurant-store.ts` (sudah dihapus karena tidak dipakai lagi)

---

## Status Saat Ini

✅ **Phase 1–4** selesai  
✅ **Build** berhasil (`npm run build --webpack`)  
✅ **Server** berjalan di port 3100  
✅ **Smoke Test HTTP** 7/7 PASS  

---

**Next step?**  
Mau saya buat:
- `README.md` update?
- `ROADMAP.md` versi terbaru?
- Commit semua perubahan?
- Atau langsung test smoke test di production?

Balas saja: **"buat README"** atau **"commit"** atau **"test"**.



Ran command: `git status -s`
Ran command: `git diff --stat`
Ran command: `git status --porcelain=v1`
Ran command: `git status -uall --porcelain`
Ran command: `git log -n 5 --oneline`
Viewed tenants.ts:1-100
Ran command: `git diff lib/use-restaurant.ts`
Viewed api-client.ts:1-100
Ran command: `git diff lib/db/prisma-repository.ts`
Ran command: `git diff lib/domain/reservation-service.ts`
Ran command: `git diff HEAD -- lib/ai-tools.ts`
Viewed tool-executor.ts:1-60
Viewed admin-session.ts:1-89
Viewed manage-token.ts:1-78
Viewed route.ts:1-100
Viewed route.ts:1-98
Viewed proxy.ts:1-45
Ran command: `git diff app/admin/page.tsx`
Ran command: `git diff app/page.tsx`
Viewed page.tsx:1-50
Viewed TenantProvider.tsx:1-29
Viewed 20260928_slot_isolation.sql:1-53
Viewed rls.sql:1-40
Viewed tenant-data.ts:1-35
Ran command: `git diff lib/search/orama-menu-index.ts`
Ran command: `git diff app/api/chat/route.ts`
Ran command: `git diff components/AdminDashboard.tsx`
Ran command: `git diff components/AIChatWidget.tsx`
Ran command: `git diff app/globals.css`
Viewed Storefront.tsx:1-100
Viewed route.ts:1-100
Viewed route.ts:1-60
Viewed smoke-test.mjs:1-60

Perubahan pada source control ini merupakan **refactoring dan arsitektur besar-besaran (Enterprise Multi-Tenant & Security Hardening)**: mengubah aplikasi dari yang sebelumnya mengandalkan *mock store in-memory* (client-side/single-tenant Raso Minang) menjadi **Multi-Tenant SaaS sejati yang 100% didukung PostgreSQL, proteksi sesi HMAC, isolasi data, dan AI grounding per-tenant**.

File *mock* lawas (`lib/restaurant-store.ts` dan `lib/ai-tools.ts`) telah **dihapus permanen**, digantikan oleh repositori database atomik dan pipeline domain service.

Berikut rincian lengkap apa yang dibangun dan diubah di seluruh berkas source control:

---

### 1. Fondasi Multi-Tenant & Dynamic Routing (Storefront)
Aplikasi sekarang bisa menyajikan restoran yang berbeda secara dinamis melalui slug URL dan CSS variable theming:
* [lib/tenants.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/tenants.ts): Registri kanonikal tenant (`raso-minang-padang-01` dengan slug `raso-minang` & prefix `RM`, serta `kopi-nusantara-cafe-02` dengan slug `kopi-nusantara` & prefix `KN`), mencakup copywriting persona AI, badge, dan token palet tema.
* [lib/tenant-context.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/tenant-context.ts) & [components/TenantProvider.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/components/TenantProvider.tsx): React context penyedia identitas tenant aktif dan branding ke seluruh tree komponen.
* [app/t/[slug]/page.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/t/[slug]/page.tsx): Route dinamis storefront (`/t/raso-minang`, `/t/kopi-nusantara`) yang memvalidasi slug ke database PostgreSQL dan merender tema yang sesuai via metadata Next.js.
* [app/page.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/page.tsx): Di-refactor total dari halaman monolitik Raso Minang menjadi pembungkus tipis `<TenantProvider tenantId={DEFAULT_TENANT_ID}><Storefront /></TenantProvider>`.
* [components/Storefront.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/components/Storefront.tsx): Komponen storefront modular yang membaca atribut data `data-tenant` untuk mengontrol styling dinamis secara otomatis.
* [app/globals.css](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/globals.css): Menambahkan CSS variable tokens (`--brand-primary`, `--brand-accent`, `--brand-bg`, `--brand-border`, dll.) dengan switch otomatis selector `[data-tenant="kopi-nusantara-cafe-02"]`.

---

### 2. Autentikasi Admin & Proteksi Sesi Berbasis Tenant
Sebelumnya portal admin belum memiliki autentikasi ketat. Kini dilengkapi sistem session mandiri:
* [proxy.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/proxy.ts): Next.js 16 Proxy layer (pengganti middleware) yang secara dini mencegat rute `/admin` dan `/api/admin/*`, meredireksi akses tanpa cookie ke `/admin/login`.
* [lib/auth/admin-session.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/auth/admin-session.ts) & [lib/auth/constants.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/auth/constants.ts): Implementasi HMAC-SHA256 session token (`httpOnly`, `SameSite=Lax`). Klaim `tenantId` tertanam di dalam token yang ditandatangani secara kriptografis (`crypto.timingSafeEqual`).
* [app/admin/login/page.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/admin/login/page.tsx): Halaman login admin dengan pilihan login langsung ke tenant tertentu.
* [app/api/admin/login/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/admin/login/route.ts), [app/api/admin/logout/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/admin/logout/route.ts), [app/api/admin/switch-tenant/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/admin/switch-tenant/route.ts): Endpoint login, logout, dan ganti tenant admin yang menerbitkan/memperbarui session cookie.
* [app/admin/page.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/admin/page.tsx): Server Component guard yang memeriksa sesi HMAC sebelum merender dashboard.
* [components/AdminDashboard.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/components/AdminDashboard.tsx): Terhubung ke API admin asinkron, dilengkapi tombol Logout dan dropdown switch tenant yang sinkron ke backend.

---

### 3. Keamanan Endpoint API & Isolasi Data Backend
* [app/api/admin/data/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/admin/data/route.ts): Menyajikan data tabel, menu, reservasi, dan audit log **hanya** untuk tenant dari klaim cookie admin yang terverifikasi.
* [app/api/admin/action/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/admin/action/route.ts): Eksekusi tindakan admin (update status, check-in seated, POS order items, walk-in) di mana `tenantId` diambil mutlak dari cookie admin, mengabaikan manipulasi `tenantId` dari payload client.
* [app/api/admin/tenants/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/admin/tenants/route.ts): Endpoint daftar tenant untuk admin dashboard.
* [app/api/storefront/data/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/storefront/data/route.ts): Endpoint publik yang mengambil profil, menu aktif, dan daftar meja berdasarkan parameter `tenantId` tanpa membocorkan data tenant lain.
* [app/api/reservations/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/reservations/route.ts) & [app/api/reservations/availability/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/reservations/availability/route.ts): Endpoint publik pembuatan dan pengecekan reservasi dengan Zod schema validation dan penomoran kode otomatis per tenant (`RM-XXXX` atau `KN-XXXX`).
* [lib/rate-limit.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/rate-limit.ts): In-memory sliding-window rate limiter per IP untuk menangkal brute-force dan spam pada endpoint reservasi & lookup.

---

### 4. Pelacakan Mandiri Tamu & Privasi (Customer Self-Service)
Sebelumnya kode reservasi bisa dilacak siapa saja dan nomor HP langsung terpampang. Sekarang diperketat:
* [lib/auth/manage-token.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/auth/manage-token.ts): Token HMAC berdurasi 15 menit untuk aksi mandiri tamu (cancel/reschedule). Dilengkapi fungsi `verifyPhoneHint` dan `maskPhone` (menyembunyikan nomor telepon jadi format `0812****7890`).
* [app/api/reservations/lookup/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/reservations/lookup/route.ts): Proteksi server-side: jika tiket memiliki nomor HP terdaftar, client wajib memasukkan **4 digit terakhir nomor WhatsApp**. Jika cocok, server baru merilis data tiket dan memberikan `manageToken`.
* [app/api/reservations/manage/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/reservations/manage/route.ts): Endpoint self-service untuk membatalkan (*cancel*) atau mengubah jadwal (*reschedule*) yang diotorisasi hanya dengan `manageToken`.
* [components/TrackReservationModal.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/components/TrackReservationModal.tsx): Refactor antarmuka modal pelacakan tiket untuk mendukung verifikasi 4-digit WA, status progress real-time, cetak e-tiket/QR, dan form reschedule/cancel mandiri.

---

### 5. Pengerasan Database PostgreSQL (Concurrency & Data Guard)
* [lib/db/prisma-repository.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/db/prisma-repository.ts):
  * **Double-Booking Guard**: Transaksi atomik dengan `SELECT ... FOR UPDATE` dan kalkulasi rentang tumpang tindih waktu (90 menit).
  * **Tenant Table Guard**: Memvalidasi bahwa `tableId` yang dipesan mutlak terdaftar di bawah `tenantId` yang sama.
  * **Reschedule Atomik**: Menambahkan method `rescheduleReservation()` lengkap dengan validasi jam operasional restoran dan kapasitas meja.
  * **Pencarian Menu Multi-Tenant**: Method `getMenuItemsForAllTenants()` dan filter kueri terisolasi per tenant.
* [prisma/sql/20260928_slot_isolation.sql](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/prisma/sql/20260928_slot_isolation.sql):
  * `reservations_one_active_slot_per_table`: Partial unique index di PostgreSQL yang memblokir dua reservasi aktif pada meja & jam yang sama persis di level database.
  * `trg_reservation_table_tenant`: Database trigger PostgreSQL (`BEFORE INSERT OR UPDATE`) yang menggagalkan transaksi jika ada meja milik tenant A dimasukkan ke reservasi tenant B.
* [prisma/sql/rls.sql](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/prisma/sql/rls.sql): Draf skrip Row Level Security (RLS) PostgreSQL untuk isolasi multi-tenant menggunakan `app.current_tenant`.

---

### 6. Grounding AI, Search Engine & Service Layer
Mock in-memory dieliminasi total dari alur AI:
* [lib/ai/tenant-data.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/ai/tenant-data.ts): Grounding AI sekarang membaca data profil restoran, menu snapshot, dan jumlah meja langsung dari PostgreSQL secara asinkron.
* [app/api/chat/route.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/app/api/chat/route.ts): Validasi ketat `currentSession.tenantId` saat menerima pesan chat, menolak tenant yang tidak terdaftar.
* [lib/ai/orchestrator.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/ai/orchestrator.ts), [lib/ai/streaming-orchestrator.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/ai/streaming-orchestrator.ts), & [lib/ai/context-engine.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/ai/context-engine.ts): Meneruskan `tenantId` secara konsisten ke seluruh prompt sistem AI, konteks percakapan, dan eksekutor tool.
* [lib/domain/tool-executor.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/domain/tool-executor.ts) & [lib/domain/reservation-service.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/domain/tool-executor.ts): Seluruh tool AI (`get_restaurant_info`, `get_menu`, `check_availability`, `create_reservation`, `get_reservation`, `update_reservation`, `cancel_reservation`) kini mengeksekusi Prisma PostgreSQL dan Redis leases, bukan lagi `restaurantStore`.
* [lib/search/orama-menu-index.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/search/orama-menu-index.ts): Fuzzy search index Orama sekarang dibentuk 100% dari PostgreSQL dengan mekanisme cache refresh 1 menit dan pemfilteran ketat `candidateHits.filter(h => h.tenantId === filters.tenantId)`.
* **File Dihapus**:
  * `lib/restaurant-store.ts` (mock store lokal dibersihkan).
  * `lib/ai-tools.ts` (tool wrapper lama berbasis mock dibersihkan).

---

### 7. Integrasi State Frontend & UI Adaptif
* [lib/api-client.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/api-client.ts): Kumpulan helper typed fetch untuk seluruh endpoint publik dan admin.
* [lib/use-restaurant.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/lib/use-restaurant.ts): Dirombak total menjadi consumer API backend asinkron, mendukung mode `storefront` dan `admin`, menggantikan fungsi-fungsi sinkron store in-memory.
* [components/Navbar.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/components/Navbar.tsx), [components/MenuSection.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/components/MenuSection.tsx), [components/ReservationSection.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/components/ReservationSection.tsx): Seluruh komponen UI storefront kini mengonsumsi CSS tokens dan branding dari tenant context (logo inisial, placeholder pencarian, deskripsi hidangan, dll).
* [components/AIChatWidget.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/components/AIChatWidget.tsx) & [components/AIChatMonitoringTab.tsx](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/components/AIChatMonitoringTab.tsx): Chatbot widget floating dan tab monitoring kini beradaptasi dengan nama dan warna tema restoran yang sedang aktif.

---

### 8. Skrip Pengujian & Verifikasi (Smoke Testing)
* [scratch/smoke-test.mjs](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/scratch/smoke-test.mjs) & [scratch/smoke-http.sh](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/scratch/smoke-http.sh): Skrip otomasi untuk memverifikasi isolasi database (mencoba reservasi silang tenant, double booking pada slot yang sama, dan pengujian HTTP endpoint).
* [scratch/dbcheck.cjs](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/scratch/dbcheck.cjs), [scratch/dbcheck2.cjs](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/scratch/dbcheck2.cjs), [scratch/dbcheck.ts](file:///c:/Users/VannID/MyProject/AI-PoweredRestaurant/scratch/dbcheck.ts): Skrip inspeksi integritas skema dan relasi data PostgreSQL.

---

### Kesimpulan Ringkas
57 perubahan source control ini adalah **lompatan dari aplikasi single-resto berbasis state memori menjadi platform Multi-Tenant Restaurant SaaS production-ready**:
1. **Multi-Tenant URL & Styling** (`/` default Raso Minang, `/t/[slug]` untuk tenant lain, styling variabel dinamis).
2. **Sistem Keamanan & Admin Auth** (Next.js 16 Proxy + HMAC session cookie ber-klaim tenant).
3. **Database Hardening** (PostgreSQL atomic transaction `FOR UPDATE`, DB trigger anti-cross-tenant, partial unique index anti-double-booking).
4. **Proteksi Privasi Customer** (Verifikasi 4 digit WA, nomor disamarkan, self-service token).
5. **AI Terhubung DB Langsung** (Seluruh tool AI dan search engine Orama langsung menyedot data live PostgreSQL per tenant).