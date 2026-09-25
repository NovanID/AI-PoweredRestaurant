# Progress PostgreSQL, Midtrans, dan Multi-Tenancy

Tanggal verifikasi: 24 September 2026
Status: fondasi lokal selesai dan build hijau

## Summary Sesi

Sesi dimulai dengan audit terhadap tiga target: koneksi Admin Dashboard dan POS ke PostgreSQL, sinkronisasi Midtrans Webhook ke PostgreSQL, serta fondasi multi-tenancy. Implementasinya ternyata sudah mulai dibuat, tetapi belum dapat dianggap selesai karena build gagal, indikator koneksi database selalu terlihat aktif, webhook tetap membalas sukses saat update database gagal, beberapa alur masih memakai ID tenant lama, dan pembayaran dapat ditandai lunas langsung dari browser.

Perbaikan difokuskan pada akar masalah. PostgreSQL sekarang menjadi sumber kebenaran, pembuatan reservasi menunggu penyimpanan database, harga POS dan nominal Midtrans diverifikasi server-side, takeaway order disimpan ke PostgreSQL, status pembayaran hanya dapat diperbarui oleh webhook terverifikasi, serta query menu dan operasional dibatasi berdasarkan tenant. Schema lokal juga diperbarui agar takeaway tidak membutuhkan meja restoran palsu.

Hasil akhirnya, typecheck dan production build berhasil. Smoke test membuktikan dua tenant dibaca dari PostgreSQL, signature webhook palsu ditolak dengan HTTP 401, nominal pembayaran palsu ditolak dengan HTTP 400, alur pembayaran PostgreSQL berhasil, dan seluruh data test sementara dibersihkan. Fondasi lokal dinyatakan selesai; autentikasi tenant, RLS, callback Midtrans Sandbox dari URL publik, commit, dan deployment tetap menjadi tahap berikutnya.

## Ringkasan

| Area | Status | Hasil |
| --- | --- | --- |
| Admin Dashboard & POS ke PostgreSQL | Selesai | Dashboard membaca data PostgreSQL dan aksi POS tersinkron ke database. |
| Midtrans Webhook ke PostgreSQL | Selesai | Webhook terverifikasi memperbarui status pembayaran langsung di PostgreSQL. |
| Fondasi Multi-Tenancy | Selesai untuk fondasi | Data, query, menu, reservasi, POS, audit, dan payment sudah tenant-scoped. |

## Perubahan yang Diselesaikan

### Admin Dashboard dan POS

- PostgreSQL dijadikan sumber kebenaran untuk profile, meja, menu, reservasi, dan audit log.
- Indikator `PostgreSQL Live` hanya aktif ketika API benar-benar mengembalikan data dari PostgreSQL.
- Kegagalan mutation mengubah dashboard ke kondisi tidak terkoneksi dan dicatat di console.
- Koleksi database yang kosong tetap ditampilkan kosong; tidak lagi diam-diam diganti mock data.
- Harga dan nama item POS dihitung ulang dari katalog PostgreSQL agar nilai dari browser tidak dipercaya.
- Reservasi web menunggu konfirmasi penyimpanan PostgreSQL sebelum membuka Midtrans, sehingga tidak ada race antara pembuatan reservasi dan token pembayaran.

### Midtrans

- Signature webhook diverifikasi memakai SHA-512 dan perbandingan constant-time.
- Token pembayaran hanya dibuat untuk order yang sudah ada di PostgreSQL.
- Nominal dari browser dan webhook harus sama dengan `orderTotal` atau `paymentAmount` di PostgreSQL.
- Snap token disimpan ke record reservasi/order.
- Browser tidak lagi dapat menandai pembayaran sebagai `settlement`; status pembayaran hanya diubah oleh webhook tepercaya.
- Webhook hanya membalas sukses setelah update PostgreSQL berhasil. Kegagalan menghasilkan respons non-2xx agar dapat dicoba ulang.
- Notifikasi duplikat dibuat idempotent dan status `settlement` tidak dapat mundur menjadi `pending`, `cancel`, atau `expire` akibat notifikasi terlambat.
- `fraud_status: deny` dipetakan sebagai pembayaran ditolak.

Referensi implementasi mengikuti panduan resmi [Midtrans HTTP Notifications](https://docs.midtrans.com/docs/https-notification-webhooks) dan [Transaction Status](https://docs.midtrans.com/reference/transaction-status).

### Multi-Tenancy

- ID tenant lama yang tidak cocok sudah diganti dengan ID tenant kanonis.
- Query repository untuk menu, meja, reservasi, POS, audit, dan payment memakai `tenantId`.
- Pencarian menu fuzzy ikut dibatasi berdasarkan tenant.
- Takeaway order kini disimpan di PostgreSQL, bukan hanya memory/localStorage.
- `reservations.table_id` dibuat opsional agar takeaway tidak dipaksa memakai meja restoran palsu.
- Schema PostgreSQL lokal `localhost:5432/ai_restaurant` sudah disinkronkan dengan Prisma.

## Verifikasi

Semua pemeriksaan berikut berhasil:

```text
npx prisma validate
npx tsc --noEmit
npm run build
npx tsx scratch/test-payment-integrity.ts
```

Hasil smoke test HTTP produksi lokal:

```text
Tenant Raso Minang source: PostgreSQL (7 reservasi)
Tenant Kopi Nusantara source: PostgreSQL (2 reservasi)
Webhook health: OK
Signature webhook palsu: HTTP 401
Nominal pembayaran palsu: HTTP 400
Temporary test rows setelah cleanup: 0
```

## Belum Termasuk

- Autentikasi admin dan tenant claim dari session pengguna.
- PostgreSQL Row-Level Security (RLS).
- Pengujian callback nyata dari Midtrans Sandbox melalui URL publik/deployment.
- Commit Git dan deployment production.

Autentikasi dan RLS perlu ditambahkan sebelum aplikasi dibuka sebagai SaaS publik. Callback Sandbox nyata diuji setelah endpoint webhook mempunyai URL HTTPS publik.
