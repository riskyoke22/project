# Sistem Terintegrasi: Buku Tamu, Kinerja, Kepegawaian, Arsip

Repositori monorepo resmi untuk platform layanan mandiri dan manajemen internal organisasi.
Mencakup modul terpadu: **Buku Tamu**, **Kinerja (SKP/OKRs)**, **Kepegawaian (HR)**, dan **Tata Kelola Arsip**.

Dibangun dengan arsitektur **Modular Monolith** berstandar keamanan tinggi (**OWASP ASVS Level 2** & kepatuhan **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi**).

---

## 1. Tumpukan Teknologi (Tech Stack)

- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zod
- **Backend API**: NestJS (TypeScript), arsitektur modular monolith, deny-by-default RBAC
- **Basis Data**: PostgreSQL 17+ (multi-skema: `core`, `hr`, `perf`, `archive`, `guest`, `audit`)
- **Akses Data**: Drizzle ORM + migrasi SQL bernomor
- **Cache & Antrean**: Redis 7+ & BullMQ
- **Object Storage**: MinIO (S3-compatible) dengan presigned URL
- **Pemindai Berkas**: ClamAV daemon
- **Reverse Proxy**: Caddy (HTTPS otomatis & header keamanan ketat)
- **Paket Monorepo**: pnpm workspace (`apps/web`, `apps/api`, `packages/shared`, `packages/config`)

---

## 2. Struktur Monorepo

```
.
├── apps/
│   ├── web/               # Next.js (Frontend & BFF)
│   └── api/               # NestJS (Backend API Modular Monolith)
├── packages/
│   ├── shared/            # Skema Zod, tipe bersama, konstanta izin RBAC
│   └── config/            # Konfigurasi ESLint, tsconfig, dan aturan boundaries
├── db/
│   ├── migrations/        # Berkas migrasi database SQL bernomor
│   ├── seeds/             # Data awal referensi & izin
│   └── schema.sql         # Snapshot skema acuan PostgreSQL
├── infra/
│   ├── docker-compose.yml # Orkestrasi kontainer lokal & VPS
│   └── caddy/             # Konfigurasi reverse proxy & header keamanan
├── scripts/
│   └── generate-keys.mjs  # Generator kunci kriptografis acak (.env.local)
└── docs/                  # Dokumentasi arsitektur, ERD, keamanan, & panduan
```

---

## 3. Panduan Menjalankan di Laptop dari Nol

### Prasyarat Sistem

- **Node.js**: v20.x atau v22.x LTS
- **pnpm**: v9.x (`corepack enable pnpm` atau `npm install -g pnpm`)
- **Docker Desktop / Docker Engine**: untuk kontainer database & dependensi
- **Git**

### Langkah 1: Kloning & Persiapan Kunci Lingkungan

Salin variabel lingkungan dan buat kunci acak kriptografis (KEK, DEK, salt, dan rahasia JWT) secara otomatis:

```bash
node scripts/generate-keys.mjs
```

_Skrip ini akan membuat berkas `.env.local` dengan nilai kunci acak yang aman._

### Langkah 2: Menjalankan Infrastruktur Lokal (Docker Compose)

Jalankan layanan database PostgreSQL, Redis, MinIO, ClamAV, dan Caddy:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Verifikasi bahwa seluruh kontainer sehat (`healthy`):

```bash
docker compose -f infra/docker-compose.yml ps
```

### Langkah 3: Memasang Dependensi

Pasang semua paket lintas workspace:

```bash
pnpm install
```

### Langkah 4: Menjalankan Mode Pengembangan (Dev Mode)

Jalankan frontend Next.js dan backend NestJS secara paralel:

```bash
pnpm dev
```

Akses aplikasi melalui browser:

- **Aplikasi Web (via Caddy Gateway)**: [http://localhost](http://localhost)
- **API Health Check**: [http://localhost/api/health](http://localhost/api/health)
- **API Readiness Check**: [http://localhost/api/ready](http://localhost/api/ready)

### Catatan Kompatibilitas Windows (`BUILD_STANDALONE`)

Pada sistem operasi Windows, Next.js fitur `output: 'standalone'` mencoba membuat symbolic link (symlink) yang memerlukan hak Administrator atau Windows Developer Mode. Jika tidak aktif, proses build akan memunculkan error `EPERM: operation not permitted, symlink`.

Untuk mencegah kendala ini saat pengembangan lokal di laptop pengembang Windows:

- `apps/web/next.config.ts` dikonfigurasi secara kondisional menggunakan variabel lingkungan `BUILD_STANDALONE=true`.
- Saat menjalankan `pnpm build` secara lokal di Windows, build berjalan dalam mode reguler tanpa standalone symlink.
- Pada lingkungan kontainer (`Dockerfile`) dan CI GitHub Actions (Linux), flag `BUILD_STANDALONE=true` otomatis diaktifkan untuk menghasilkan paket standalone siap produksi.

---

## 4. Layanan Logger & Audit Logging

Backend NestJS (`apps/api`) dilengkapi dengan logger terstruktur berbasis **Pino JSON** (`AppLogger` dan `RequestLoggerMiddleware`):

- **Request ID Tracing**: Setiap permintaan HTTP secara otomatis diberi identifier unik melalui header `X-Request-Id` (atau mempertahankan header dari klien jika sudah ada), yang dicatat pada setiap baris log request lifecycle.
- **Redaksi Data Sensitif Otomatis**: Bidang kredensial dan data pribadi (PII) disensor otomatis menjadi `[REDACTED]` agar tidak pernah bocor ke file log atau log aggregator. Mencakup: `password`, `token`, `refreshToken`, `nik`, `identity_number`, `secret`, `authorization`, dan cookie headers.
- **Variabel Lingkungan Logger**:
  - `LOG_LEVEL`: Tingkat pencatatan log (`debug`, `info`, `warn`, `error`). Default `debug` di development dan `info` di production.
  - `NODE_ENV`: Mengatur environment runtime (`development`, `production`, `test`).

---

## 5. Perintah Mutu & Pengujian (Quality Gates)

| Perintah            | Deskripsi                                                           |
| ------------------- | ------------------------------------------------------------------- |
| `pnpm lint`         | Memeriksa kepatuhan kode dan batasan arsitektur (ESLint Boundaries) |
| `pnpm typecheck`    | Validasi tipe data statis TypeScript strict di seluruh paket        |
| `pnpm test`         | Menjalankan seluruh pengujian unit & integrasi (Vitest)             |
| `pnpm build`        | Membangun seluruh paket `packages/*` dan aplikasi `apps/*`          |
| `pnpm format:check` | Memeriksa format kode (Prettier)                                    |
| `pnpm format`       | Memperbaiki format kode secara otomatis                             |

---

## 6. Pagar Mutu & Batasan Arsitektur (Architecture Boundaries)

Repositori ini menerapkan **Modular Monolith** dengan aturan tegas yang ditegakkan otomatis oleh ESLint:

1. **Pemisahan Modul**: Modul (`apps/api/src/modules/<nama>`) dilarang keras mengimpor file internal modul lain secara langsung. Komunikasi lintas modul wajib melalui _public service_ atau _event domain_.
2. **Lapisan Bersama**: Lapisan bersama (`src/common/`) dilarang mengimpor file dari `src/modules/`.
3. **Deny-by-Default Otorisasi**: Seluruh endpoint API backend wajib memiliki dekorator izin RBAC eksplisit.
4. **Data Sensitif Terenkripsi**: NIK, kontak tamu, dan rahasia MFA wajib dienkripsi (`_enc`) dengan blind index (`_hash`) untuk kebutuhan pencarian.
5. **Gitleaks Pre-commit**: Mencegah rahasia, password, atau kunci ter-commit ke dalam Git.

---

## 7. Lisensi

Hak Cipta &copy; 2026. Seluruh hak cipta dilindungi undang-undang.
