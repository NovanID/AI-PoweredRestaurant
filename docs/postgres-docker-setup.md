# PostgreSQL Docker + Prisma Setup

Project ini sekarang punya setup PostgreSQL lokal via Docker Desktop dan Prisma connection foundation.

## 1. Jalankan PostgreSQL

Pastikan Docker Desktop sudah menyala, lalu jalankan:

```bash
npm run db:up
```

Service yang dibuat:

- Container: `ai-powered-restaurant-postgres`
- Database: `raso_minang`
- User: `raso_minang`
- Port lokal: `55432`

## 2. Environment

Pastikan `.env.local` punya:

```env
DATABASE_URL="postgresql://raso_minang:raso_minang_password@127.0.0.1:55432/raso_minang?schema=public"
```

Contoh lengkap tersedia di `.env.example`.

## 3. Push Prisma Schema ke DB

Setelah container sehat, jalankan:

```bash
npm run db:push
npm run prisma:generate
```

Ini akan membuat tabel sesuai `prisma/schema.prisma` dan generate Prisma Client.

## 4. Jalankan App

```bash
npm run dev
```

Cek health endpoint:

```text
http://localhost:3000/api/db/health
```

Expected:

```json
{
  "database": "postgresql",
  "status": "ok"
}
```

Atau via script:

```bash
npm run db:health
```

Catatan: tahap ini baru menyambungkan PostgreSQL + Prisma. Feature utama app masih local/mock store dan belum dimigrasikan penuh ke database.

## 5. Stop Database

```bash
npm run db:down
```
