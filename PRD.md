# PRD — AI-Powered Restaurant MVP

**Status:** Draft untuk review  
**Tanggal:** 19 Agustus 2026  
**Owner:** Vanny (NovanID)  
**Target:** Single-restaurant MVP, tenant-aware from day one

---

## 1. Ringkasan Produk

AI-Powered Restaurant MVP adalah aplikasi web sederhana untuk satu restoran Padang yang membantu customer mencari informasi, melihat menu, mengecek ketersediaan meja, dan mengelola reservasi. Staff restoran menggunakan dashboard untuk mengelola menu, meja, customer, dan reservasi.

AI Assistant menjadi antarmuka tambahan berbasis bahasa natural. AI tidak boleh menebak fakta operasional atau mengakses database secara langsung; harga, stok menu, availability, dan reservasi harus berasal dari Restaurant API melalui tools terkontrol.

## 2. Masalah

- Customer harus mencari informasi atau melakukan reservasi melalui chat manual, telepon, atau form statis.
- Staff menghabiskan waktu menjawab pertanyaan berulang dan mencatat reservasi.
- Informasi operasional dapat tidak konsisten jika tidak berasal dari satu sumber data.
- Chatbot biasa dapat memberi jawaban salah ketika menebak harga, stok, atau availability.

## 3. Tujuan MVP

1. Customer dapat menemukan menu dan membuat, melihat, mengubah, atau membatalkan reservasi melalui web.
2. Staff dapat mengelola data inti restoran dari satu dashboard.
3. AI Assistant dapat menjawab FAQ/menu dan membantu reservasi menggunakan tools yang sama dengan aplikasi web.
4. Seluruh fakta operasional berasal dari database melalui business logic/API.
5. Sistem dibangun sebagai vertical slice satu restoran Padang secara bertahap dalam target enam bulan.

## 4. Bukan Tujuan MVP

- Self-service onboarding banyak restoran.
- Billing SaaS, subscription, atau marketplace.
- Multi-agent, A2A, autonomous workflow, browser agent, atau agent payments.
- Prediksi demand/churn dan analytics lanjutan.
- Personalisasi berbasis long-term AI memory.
- Kubernetes, microservices, atau distributed architecture.
- Telegram/Discord sebagai channel produksi.

## 5. Pengguna

### Customer

Ingin menemukan informasi restoran dan mengelola reservasi dengan cepat tanpa harus menghubungi staff.

### Admin / Restaurant Staff

Ingin mengelola menu, meja, customer, dan reservasi serta memastikan availability selalu akurat.

## 6. Ruang Lingkup Fungsional

### 6.1 Customer Web

- Melihat profil restoran, jam buka, kontak, dan kebijakan.
- Melihat dan mencari menu berdasarkan nama/kategori.
- Melihat harga dan status ketersediaan menu.
- Mengecek meja berdasarkan tanggal, waktu, dan jumlah tamu.
- Membuat reservasi dengan nama, kontak, waktu, jumlah tamu, dan catatan.
- Melihat reservasi menggunakan kode reservasi dummy pada tahap MVP.
- Mengubah waktu/jumlah tamu jika meja tersedia.
- Membatalkan reservasi.

### 6.2 Admin Dashboard

- Login sebagai staff.
- Mengelola profil, jam buka, dan kebijakan restoran.
- Membuat, mengubah, menonaktifkan, dan mengelompokkan menu.
- Membuat dan mengubah nomor meja, kapasitas, area, dan status meja.
- Melihat, membuat, mengubah, mengonfirmasi, dan membatalkan reservasi.
- Melihat data customer dan riwayat reservasinya.

### 6.3 AI Assistant MVP

- Menjawab FAQ restoran.
- Mencari dan menjelaskan menu berdasarkan data aktif.
- Mengecek availability melalui tool.
- Membuat reservasi berstatus `pending` setelah customer mengonfirmasi detail.
- Mengambil, mengubah, dan membatalkan reservasi setelah verifikasi customer.
- Menyatakan tidak tahu atau meminta klarifikasi bila data tidak cukup.

### 6.4 Restaurant AI Tools

- `get_restaurant_info`
- `get_menu` / `search_menu`
- `check_availability`
- `create_reservation`
- `get_reservation`
- `update_reservation`
- `cancel_reservation`

Tools memanggil Restaurant API dan business logic yang sama dengan UI. AI tidak memiliki akses database langsung.

## 7. Aturan Bisnis MVP

- Satu meja tidak boleh memiliki reservasi aktif yang waktunya bertabrakan.
- Meja hanya dapat dipilih bila kapasitasnya mencukupi jumlah tamu dan statusnya aktif.
- Reservasi harus berada dalam jam operasional dan mengikuti batas pemesanan restoran.
- Reservasi baru berstatus `pending` sampai disetujui atau ditolak staff.
- Harga, availability menu, meja, dan status reservasi selalu dibaca dari database.
- Pembuatan/perubahan/pembatalan reservasi oleh AI memerlukan konfirmasi eksplisit customer.
- Aksi admin dan perubahan status reservasi dicatat dengan waktu serta pelakunya.
- Data memiliki `tenant_id` sejak awal, tetapi MVP hanya mengoperasikan satu tenant.

## 8. Alur Utama

### Reservasi via Web

Customer memilih tanggal, waktu, dan jumlah tamu → sistem mengecek availability → customer mengisi identitas → sistem membuat reservasi `pending` → staff menyetujui atau menolak → customer melihat status dengan kode dummy.

### Reservasi via AI

Customer menyampaikan kebutuhan → AI mengekstrak detail → tool mengecek availability → AI menawarkan opsi → customer mengonfirmasi → tool membuat reservasi `pending` → AI menjelaskan bahwa reservasi menunggu persetujuan staff.

### Pengelolaan oleh Staff

Staff login → melihat reservasi `pending` → menyetujui atau menolak → status dan availability diperbarui.

## 9. Data Inti

- Restaurant: profile, opening hours, policies, contact.
- Table: number, capacity, area, status, tenant.
- Menu: name, category, description, price, availability, tenant.
- Customer: name, contact, reservation history, tenant.
- Reservation: customer, table, start time, guest count, status, notes, tenant.
- Audit Event: actor, action, entity, timestamp.

## 10. Persyaratan Non-Fungsional

- Authorization diterapkan pada seluruh endpoint admin.
- Semua query bisnis di-scope dengan `tenant_id`; isolasi diperkuat di database bila platform mendukung row-level security.
- Input divalidasi di server; data customer tidak boleh muncul dalam log aplikasi secara berlebihan.
- Operasi reservasi harus atomic untuk mencegah double booking.
- UI customer dan admin responsif serta memenuhi aksesibilitas dasar keyboard, label, dan kontras.
- Kegagalan AI tidak boleh menghalangi customer memakai flow reservasi biasa.
- Setiap tool call AI dapat ditelusuri dari request, input, hasil, hingga respons akhir tanpa menyimpan rahasia.

## 11. Definition of Done

- Admin dapat memasukkan profil restoran, meja, menu, dan kebijakan.
- Customer dapat mencari menu dan menyelesaikan lifecycle reservasi melalui web.
- AI dapat menjawab FAQ/menu dan menyelesaikan lifecycle reservasi melalui tools.
- Percobaan double booking ditolak secara konsisten.
- AI tidak mengarang harga, stok, availability, atau status reservasi ketika tool gagal.
- Data/API admin tidak dapat diakses customer tanpa izin.
- Skenario utama berjalan di mobile dan desktop.
- Tersedia demo end-to-end dan seed data untuk satu restoran.

## 12. Indikator Keberhasilan Awal

- ≥90% skenario reservasi uji selesai tanpa bantuan staff.
- 100% percobaan double booking pada pengujian ditolak.
- 100% fakta operasional dalam evaluasi AI cocok dengan hasil tool/database.
- Median waktu menyelesaikan reservasi web ≤3 menit pada usability test kecil.
- Staff dapat menambahkan menu dan meja tanpa bantuan developer.

## 13. Tahapan Delivery

1. **Bulan 1–2 — Core:** data model, auth staff, profil restoran, meja, menu, customer, dan reservasi.
2. **Bulan 3 — Customer Web:** menu, availability, serta create/view/update/cancel reservation.
3. **Bulan 4–5 — AI MVP:** FAQ/menu, tool layer, reservation flow, dan integrasi 9router/Hermes.
4. **Bulan 6 — Hardening:** security, pengujian double booking, accessibility, demo data, dan observability minimum.

## 14. Keputusan Produk yang Dikunci

- Restoran demo: restoran Padang.
- Status awal reservasi: `pending`; staff menyetujui atau menolak.
- Verifikasi customer: kode reservasi dummy/minimal untuk MVP; autentikasi kuat ditunda.
- Pembayaran/deposit: di luar MVP.
- Bahasa: Bahasa Indonesia saja.
- Timeline: enam bulan dengan flow dibangun dan didokumentasikan satu per satu.

Jika sebuah fitur tidak dibutuhkan untuk menyelesaikan flow aktif, fitur tersebut ditunda.


teach stack:
next js
nest js
postgres
