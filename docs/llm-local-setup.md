# OpenRouter LLM Local Setup

Dokumen ini menjelaskan cara menjalankan AI Assistant Raso Minang secara lokal setelah integrasi OpenRouter, structured tool calling, dan model routing.

## 1. Environment Variables

Buat `.env.local` di root project. Jangan commit file ini.

```env
OPENROUTER_API_KEY=sk-or-dummy-local-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_URL=http://localhost:3000
OPENROUTER_APP_NAME=AI-Powered Restaurant

LLM_FAST_MODEL=openai/gpt-4o-mini
LLM_DEFAULT_MODEL=openai/gpt-4o-mini
LLM_TOOL_MODEL=openai/gpt-4o-mini
LLM_REASONING_MODEL=openai/gpt-4o
LLM_CLASSIFIER_MODEL=openai/gpt-4o-mini
```

Catatan:

- Ganti `OPENROUTER_API_KEY` dengan API key OpenRouter asli untuk testing end-to-end.
- `LLM_CLASSIFIER_MODEL` sudah disiapkan, tetapi routing awal masih rule-based.
- Jika env belum diset, UI tetap mendapat error aman: AI Assistant sedang mengalami kendala.

## 2. Data Local-First

Tahap ini masih memakai data local/mock:

- `lib/mock-data.ts`
- `lib/restaurant-store.ts`
- `localStorage` untuk sisi browser

AI server tools memakai `restaurantStore` di server. Karena itu, selama fase local-first, data yang dilihat AI server bisa tidak selalu sinkron sempurna dengan perubahan yang tersimpan di localStorage browser. Sinkronisasi penuh akan lebih tepat dilakukan di fase database shared seperti Prisma/PostgreSQL atau dengan client state snapshot.

## 3. Cara Menjalankan

```bash
npm install
npm run dev
```

Buka:

```text
http://localhost:3000
```

Gunakan widget AI di kanan bawah halaman.

## 4. Manual Test Prompts

Gunakan prompt berikut untuk smoke test:

### FAQ Restoran

```text
Alamat restoran di mana?
```

Expected:

- AI memakai tool informasi restoran.
- Jawaban menyebut Raso Minang, alamat, kontak, atau jam operasional.

### Menu

```text
Berapa harga rendang?
```

Expected:

- AI memakai tool menu/search menu.
- Jawaban berdasarkan data menu, bukan karangan.

### Availability

```text
Ada meja untuk 4 orang besok jam 19.00?
```

Expected:

- AI memakai `check_availability`.
- Jawaban menyebut apakah meja tersedia atau alasan tidak tersedia.

### Create Reservation

```text
Saya mau booking meja untuk 4 orang besok jam 19.00 atas nama Budi nomor 081234567890
```

Expected:

- AI tidak langsung membuat reservasi.
- AI meminta konfirmasi terlebih dahulu.
- Setelah user menjawab `Ya, konfirmasi`, tool protected `create_reservation` baru dijalankan.

### Update Reservation

```text
Ubah reservasi RM-1001 jadi besok jam 19.00
```

Expected:

- AI meminta konfirmasi sebelum menjalankan update.

### Cancel Reservation

```text
Batalkan reservasi RM-1001
```

Expected:

- AI meminta konfirmasi sebelum membatalkan reservasi.

## 5. Verification Commands

```bash
npm test
npm run typecheck
npm run build
```

`npm test` menjalankan test AI berbasis Node native test runner melalui `scripts/run-ai-tests.mjs`.
