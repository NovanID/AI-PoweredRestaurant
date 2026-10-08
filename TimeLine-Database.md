DATABASE OVERHAUL & RECONCILIATION — READ ONLY FIRST

Saya ingin kamu fokus terlebih dahulu pada database layer project ini.

Kondisi project saat ini:
- Project sudah memiliki banyak fitur yang berjalan.
- Database saat ini menggunakan PostgreSQL.
- Prisma digunakan dalam project.
- ERD saat ini secara garis besar memiliki entity:
  1. Restaurant
  2. Customer
  3. Reservation
  4. Table
  5. MenuItem
  6. AuditEvent
- Project sudah cukup jauh dan bukan lagi tahap awal development.
- Kekhawatiran utama saya adalah database berkembang lebih lambat daripada perkembangan fitur aplikasi, sehingga ada data, relationship, constraint, atau kebutuhan bisnis yang belum direpresentasikan dengan baik di database.

TUJUAN UTAMA:

Saya ingin database saat ini benar-benar mencerminkan kondisi REAL project, bukan hanya mencerminkan fitur yang saat ini sudah dibuat di Prisma schema.

Jangan langsung melakukan perubahan database.

PHASE 1 — INVENTORY PROJECT

Analisis seluruh project terlebih dahulu.

Identifikasi:
- seluruh fitur yang sudah ada
- seluruh business flow
- seluruh API/route
- seluruh server action
- seluruh service
- seluruh tool/function AI
- seluruh admin functionality
- seluruh proses reservation
- seluruh proses customer
- seluruh proses menu
- seluruh proses restaurant/tenant
- seluruh proses table/floor plan
- seluruh audit/logging
- seluruh payment/order/takeaway flow
- seluruh konfigurasi tenant
- seluruh data yang disimpan, dibaca, diubah, atau dihapus oleh aplikasi

Jangan hanya membaca prisma/schema.prisma.

Cari penggunaan database di seluruh codebase.

PHASE 2 — DATABASE INVENTORY

Audit database yang sekarang.

Periksa:
- Prisma schema
- migrations
- PostgreSQL schema
- tables
- columns
- primary keys
- foreign keys
- unique constraints
- indexes
- nullable/non-nullable fields
- default values
- enum
- relation
- cascade behavior
- JSON fields
- Decimal/numeric fields
- timestamp fields
- status fields
- tenantId usage
- audit fields
- soft delete jika ada
- data integrity constraints

Pastikan Prisma schema dan database PostgreSQL benar-benar sinkron.

PHASE 3 — FEATURE → DATA MAPPING

Buat mapping:

FEATURE
→ DATA YANG DIBUTUHKAN
→ TABLE
→ COLUMN
→ RELATIONSHIP
→ CONSTRAINT
→ STATUS

Contoh:

Reservation
→ customer
→ restaurant
→ table
→ reservation time
→ party size
→ status
→ order/items jika memang bagian dari flow
→ payment jika memang terkait
→ audit event

Tujuannya adalah menemukan fitur yang membutuhkan data tetapi database belum merepresentasikannya dengan benar.

PHASE 4 — GAP ANALYSIS

Cari semua kemungkinan:

1. Data yang digunakan aplikasi tetapi belum memiliki representasi database yang proper.
2. Column yang sebenarnya menyimpan terlalu banyak konsep sekaligus.
3. JSON field yang mungkin seharusnya menjadi relational data.
4. Relationship yang hilang.
5. Foreign key yang belum ada.
6. Unique constraint yang belum ada.
7. Index yang dibutuhkan berdasarkan query nyata.
8. Data yang seharusnya tenant-scoped tetapi belum memiliki tenant isolation yang jelas.
9. Status/state yang tidak memiliki constraint atau lifecycle yang jelas.
10. Data duplicate yang berpotensi terjadi.
11. Data yang bisa orphan.
12. Data yang seharusnya immutable tetapi masih dapat diubah.
13. Data penting yang hanya hidup di application state tetapi seharusnya persistent.
14. Data yang sebenarnya dibutuhkan untuk audit/debugging tetapi belum disimpan.
15. Data yang dibutuhkan untuk reporting/analytics tetapi belum tersedia.
16. Data yang dibutuhkan untuk concurrency/idempotency tetapi belum direpresentasikan.
17. Data yang berpotensi menyebabkan cross-tenant data leakage.
18. Data sensitif yang penyimpanannya perlu ditinjau.

PHASE 5 — MULTI-TENANT AUDIT

Karena project ini merupakan B2B SaaS multi-tenant, perlakukan tenant isolation sebagai prioritas.

Untuk SETIAP entity, jawab:

- Apakah entity ini tenant-scoped?
- Bagaimana entity mengetahui tenant/restaurant pemiliknya?
- Apakah tenantId diperlukan?
- Apakah relationship dapat menyebabkan data antar-tenant tercampur?
- Apakah query aplikasi selalu membatasi tenant?
- Apakah unique constraint sudah tenant-aware?
- Apakah index sudah mempertimbangkan tenantId?
- Apakah ada kemungkinan ID dari tenant A digunakan untuk mengakses data tenant B?

Jangan hanya mengatakan "ada tenantId".
Validasi bagaimana tenant isolation benar-benar bekerja di application + database layer.

PHASE 6 — NORMALIZATION REVIEW

Jangan melakukan normalisasi hanya karena teori database.

Evaluasi berdasarkan business domain nyata.

Untuk setiap entity yang kompleks, tentukan apakah entity tersebut:
- memang satu aggregate/domain object
- memiliki terlalu banyak responsibility
- memiliki atribut yang seharusnya dipisahkan
- memiliki embedded JSON yang sudah terlalu kompleks
- memiliki relationship yang seharusnya menjadi entity tersendiri

Berikan alasan bisnis/teknis untuk setiap rekomendasi.

PHASE 7 — SECURITY & INTEGRITY REVIEW

Audit:

- SQL injection exposure
- unauthorized database access
- cross-tenant access
- excessive database privileges
- missing foreign keys
- missing constraints
- unsafe cascade delete
- sensitive data exposure
- plaintext secrets
- auditability
- accidental destructive operations
- race condition
- duplicate records
- idempotency
- transaction boundaries

Jangan hanya melihat application security.
Evaluasi database security dan integrity secara terpisah.

PHASE 8 — PERFORMANCE REVIEW

Gunakan query nyata dari codebase.

Cari:
- N+1 query
- query tanpa index
- over-fetching
- unnecessary joins
- inefficient filtering
- tenant-scoped queries tanpa index yang sesuai
- sorting/filtering berdasarkan column yang belum di-index
- JSON query yang berpotensi mahal

Jangan membuat index secara membabi buta.
Setiap index harus punya alasan berdasarkan query pattern.

PHASE 9 — PRODUCE A DATABASE GAP REPORT

Sebelum mengubah apa pun, buat laporan:

A. Current Database Architecture
B. Current Entities
C. Entity Responsibilities
D. Relationship Map
E. Feature → Database Mapping
F. Missing Data
G. Missing Relationships
H. Missing Constraints
I. Missing Indexes
J. Multi-Tenant Risks
K. Security Risks
L. Data Integrity Risks
M. Performance Risks
N. Potential Over-Normalization / Under-Normalization
O. Recommended Schema Changes

Untuk setiap rekomendasi gunakan:

[PRIORITY]
[CURRENT STATE]
[PROBLEM]
[WHY IT MATTERS]
[RECOMMENDED CHANGE]
[IMPACT]
[RELATED FEATURES]

Jangan mengubah code atau database sebelum laporan ini selesai.

PHASE 10 — CHANGE PLAN

Setelah audit selesai, buat migration plan bertahap.

Prioritaskan:

P0 = data integrity / security / tenant isolation
P1 = missing core business data / broken relationships
P2 = performance / indexing
P3 = architectural cleanup
P4 = optional improvements

Jangan melakukan massive rewrite jika tidak diperlukan.

Prinsip utama:

1. Preserve existing working functionality.
2. Jangan membuat entity hanya karena "best practice".
3. Jangan menghapus data/schema tanpa bukti bahwa data tersebut tidak diperlukan.
4. Jangan melakukan migration sebelum impact analysis.
5. Jangan mengubah schema hanya untuk membuat ERD terlihat lebih kompleks.
6. Database harus mengikuti business domain dan real feature flow.
7. Prisma schema harus tetap sinkron dengan PostgreSQL.
8. PostgreSQL adalah production source of truth untuk actual persisted data.
9. Setiap perubahan schema harus memiliki migration yang jelas.
10. Semua perubahan harus backward-aware terhadap fitur existing.

IMPORTANT:

Jangan menganggap 6 entity berarti database sudah cukup atau terlalu sederhana.

Fokus pada:
"Apakah database saat ini mampu merepresentasikan seluruh state dan data yang benar-benar dibutuhkan oleh aplikasi?"

Bukan:
"Apakah jumlah table sudah banyak?"

STOP setelah Phase 1–9 dan berikan audit report terlebih dahulu.



JANGAN IMPLEMENTASIKAN PERUBAHAN SAMPAI SAYA REVIEW HASIL AUDIT TERSEBUT.