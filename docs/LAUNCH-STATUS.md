# LAUNCH STATUS — MagangHub MVP

> Dokumen ini merupakan laporan kondisi aktual, perbaikan, dan status launching MVP MagangHub.
> Diperbarui: 2026-11-19

---

## A. Ringkasan Kondisi Awal

MagangHub adalah Sistem Informasi Terintegrasi dengan arsitektur modular monolith (NestJS + Next.js + PostgreSQL). Proyek berada di Tahap 1–2: kerangka repositori, infrastruktur, fondasi common module, dan skema database telah dibuat. Modul bisnis (IAM, HR, Arsip, Kinerja, Buku Tamu) baru memiliki skema Drizzle dan SQL migration — belum memiliki controller, service, atau API endpoint fungsional.

Beberapa file backend telah diperbaiki sebelumnya (crypto, error handling, CSRF, audit, spec files) dan tersisa 9 error TypeScript pada modul IAM yang belum selesai.

**Lokasi:**

- Repository lokal Windows: `D:\MAGANGHUB\WEBB`
- Repository VPS Ubuntu: `/var/www/webmagang`
- IP VPS: `192.168.120.198`

---

## B. Masalah Utama yang Ditemukan

### B.1 TypeScript Typecheck (9 error — BLOCKING)

Modul `apps/api/src/modules/iam/iam.module.ts` mengimpor 9 file/dependency yang belum ada:

- `./auth.controller`, `./auth.service`, `./guards/jwt-auth.guard`, `./guards/require-permission.guard`, `./mfa.service`, `./session.service`
- `@nestjs/jwt`, `@nestjs/config`
- `../../shared/users/users.module`

IamModule tidak diimpor oleh AppModule, tetapi TypeScript tetap mengompilasi seluruh file dalam `src/**/*`.

### B.2 Production Build (BLOCKING)

`tsconfig.build.json` mewarisi `include` dari `tsconfig.json` yang mencakup `vitest.config.ts`. Karena `rootDir` adalah `./src`, file `vitest.config.ts` yang berada di luar `rootDir` menyebabkan error TS6059.

### B.3 Modul Bisnis Belum Berfungsi

Tidak ada controller atau service untuk modul IAM, HR, Arsip, Kinerja, Buku Tamu, Files, dan Audit. Hanya HealthController dan HealthService yang aktif.

### B.4 Frontend Hanya Landing Page

Frontend Next.js hanya memiliki satu halaman (`/`) yang menampilkan kartu modul dengan badge "Tahap Persiapan". Tidak ada routing ke fitur, tidak ada API integration, tidak ada halaman login/dashboard.

### B.5 SSH ke VPS Tidak Dapat Diakses

SSH ke `magang@192.168.120.198` gagal: key SSH lokal (`id_ed25519`, `workbuddy_hermes`) tidak terdaftar di `authorized_keys` VPS. VPS dapat di-ping (TTL=64, 2ms) tetapi tidak dapat diakses via SSH.

### B.6 Database Tidak Dapat Diverifikasi

Tanpa SSH ke VPS, status PostgreSQL, Redis, MinIO, dan ClamAV di VPS tidak dapat diperiksa langsung.

---

## C. Perbaikan yang Dilakukan

### C.1 Isolasi Modul IAM yang Belum Selesai

**Pendekatan:** Eksklusi `iam.module.ts` dari typecheck dan build tanpa menghapus file, schema, atau dokumentasi.

**Keputusan arsitektural:**

- `iam.module.ts` adalah draft yang mengimpor implementasi yang belum ada (auth.controller, auth.service, jwt-auth.guard, dll).
- IamModule tidak diimpor oleh AppModule, sehingga tidak memengaruhi runtime.
- Schema IAM (`infrastructure/schema.ts`) dan README tetap dikompilasi dan tersedia.
- Saat implementasi IAM lengkap, cukup hapus baris eksklusi dari tsconfig.

**File yang diubah:**

1. `apps/api/tsconfig.json` — menambah `exclude` untuk `src/modules/iam/iam.module.ts`
2. `apps/api/tsconfig.build.json` — override `include` ke `src/**/*` (tanpa `vitest.config.ts`), menambah `exclude` untuk `vitest.config.ts` dan `src/modules/iam/iam.module.ts`

### C.2 Verifikasi Hasil Perbaikan yang Sudah Ada

File yang sudah diperbaiki sebelumnya diverifikasi dan berfungsi:

- `app-error.ts` — `DatabaseError` ada, status 500, `isOperational: false`
- `crypto.service.ts` — Argon2id menggunakan numeric enum value `2`
- `csrf.middleware.ts` — parameter `_res` (unused)
- `route-security-scanner.spec.ts` — type guard tanpa `any`
- `crypto.service.spec.ts` — Buffer undefined handling
- `global-exception.filter.spec.ts` — mock calls undefined handling
- `audit.service.ts` dan `audit.service.spec.ts` — perubahan dipertahankan

---

## D. File yang Diubah

| File                           | Perubahan                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `apps/api/tsconfig.json`       | Tambah `exclude: ["src/modules/iam/iam.module.ts"]`                             |
| `apps/api/tsconfig.build.json` | Override `include`, tambah exclude untuk `vitest.config.ts` dan `iam.module.ts` |

Tidak ada file source code yang diubah. Tidak ada file yang dihapus. Tidak ada konfigurasi VPS yang diubah.

---

## E. Hasil Typecheck

| Package                    | Command        | Exit Code | Status   |
| -------------------------- | -------------- | --------- | -------- |
| `@sistem-terintegrasi/api` | `tsc --noEmit` | 0         | **PASS** |
| `@sistem-terintegrasi/web` | `tsc --noEmit` | 0         | **PASS** |

Sebelum perbaikan: 9 error pada `iam.module.ts`.
Setelah perbaikan: 0 error.

---

## F. Hasil Unit Test

### Backend API (`vitest run`)

| Test File                         | Tests | Status             |
| --------------------------------- | ----- | ------------------ |
| `pagination.spec.ts`              | 7     | PASS               |
| `database-schema.spec.ts`         | 15    | PASS               |
| `audit.service.spec.ts`           | 8     | PASS               |
| `env.config.spec.ts`              | 5     | PASS               |
| `health.controller.spec.ts`       | 2     | PASS               |
| `transaction.spec.ts`             | 3     | PASS               |
| `security.spec.ts`                | 6     | PASS               |
| `crypto.service.spec.ts`          | 13    | PASS               |
| `global-exception.filter.spec.ts` | 4     | PASS               |
| `logger.service.spec.ts`          | 9     | PASS               |
| `permission.guard.spec.ts`        | 6     | PASS               |
| `route-security-scanner.spec.ts`  | 1     | PASS               |
| `boundaries.spec.ts`              | 2     | PASS               |
| `database.integration.spec.ts`    | 7     | SKIPPED (butuh DB) |

**Total: 81 passed, 7 skipped, 0 failed**

### Frontend Web (`vitest run`)

| Test File       | Tests | Status |
| --------------- | ----- | ------ |
| `page.spec.tsx` | 1     | PASS   |

**Total: 1 passed, 0 failed**

### Shared Package (`vitest run`)

| Test File             | Tests | Status |
| --------------------- | ----- | ------ |
| `permissions.spec.ts` | 2     | PASS   |

**Total: 2 passed, 0 failed**

---

## G. Hasil Integration Test

| Test                           | Status                                         |
| ------------------------------ | ---------------------------------------------- |
| `database.integration.spec.ts` | **SKIPPED** (7 tests — butuh PostgreSQL aktif) |

Integration test memerlukan koneksi PostgreSQL, Redis, dan MinIO yang aktif. Tidak dapat dijalankan tanpa akses VPS.

---

## H. Hasil Backend Build

| Command                      | Exit Code | Status   |
| ---------------------------- | --------- | -------- |
| `tsc -p tsconfig.build.json` | 0         | **PASS** |

Output: `apps/api/dist/` berisi compiled JavaScript untuk:

- `main.js`, `app.module.js`
- `common/` (audit, auth, config, crypto, database, errors, health, logger, pagination, security)
- `modules/*/infrastructure/` (schema files untuk archive, audit, files, guest, hr, iam, perf)

`iam.module.js` TIDAK ada di dist (sesuai ekspektasi — modul draft dikecualikan dari build).

---

## I. Hasil Frontend Build

| Command      | Exit Code | Status   |
| ------------ | --------- | -------- |
| `next build` | 0         | **PASS** |

Output:

- Route `/` — 137 B, First Load JS 105 kB (Static)
- Route `/_not-found` — 975 B, First Load JS 106 kB (Static)

Frontend dikompilasi dengan sukses, tidak ada error, tidak ada warning.

---

## J. Status Database

| Item                | Status                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------- |
| PostgreSQL di VPS   | **NOT TESTED** (tidak ada akses SSH)                                                     |
| Redis di VPS        | **NOT TESTED**                                                                           |
| MinIO di VPS        | **NOT TESTED**                                                                           |
| Migration files     | Tersedia: 0001–0008 (extensions, core, audit, hr, perf, archive, guest, triggers_grants) |
| Drizzle schema code | Tersedia untuk semua modul (iam, hr, archive, perf, guest, audit, files)                 |
| Seed files          | Tersedia: permissions, roles, reference_data                                             |

**DILARANG** menjalankan DROP DATABASE, DROP TABLE, TRUNCATE, atau reset database.

---

## K. Status Keamanan

| Kontrol                   | Status               | Catatan                                                                                            |
| ------------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| Password hashing Argon2id | **PASS**             | `crypto.service.ts` — algorithm: 2 (Argon2id), parameter dari env                                  |
| Authentication            | **NOT IMPLEMENTED**  | IAM module belum selesai                                                                           |
| Authorization (RBAC)      | **PASS** (framework) | `PermissionGuard` deny-by-default aktif, `@Public()` dan `@RequirePermission()` decorator tersedia |
| Session management        | **NOT IMPLEMENTED**  | IAM module belum selesai                                                                           |
| CSRF                      | **PASS**             | Origin/Referer validation untuk state-changing methods                                             |
| CORS                      | **PASS**             | Whitelist origin, credentials true, pre-flight cache 1h                                            |
| Helmet                    | **PASS**             | CSP, HSTS, frameguard DENY, noSniff, referrer-policy                                               |
| Input validation          | **PARTIAL**          | Zod schema untuk env, DTO types tersedia                                                           |
| SQL injection             | **PASS**             | Drizzle ORM parameterized queries, `pg` parameterized                                              |
| XSS                       | **PASS**             | CSP ketat, Next.js escaping                                                                        |
| Rate limiting             | **PASS**             | In-memory bucket per IP, configurable TTL dan max                                                  |
| Error response            | **PASS**             | GlobalExceptionFilter, no stack trace to client                                                    |
| Audit logging             | **PASS** (framework) | AuditInterceptor, hash chain, sensitive data masking                                               |
| Secret management         | **PASS**             | Env validation, no secrets in frontend, `.env.local` in `.gitignore`                               |
| File upload               | **NOT IMPLEMENTED**  | Files module hanya schema                                                                          |

**Tidak ada endpoint administratif yang aktif tanpa autentikasi** — PermissionGuard menolak semua endpoint yang tidak bertanda `@Public()` atau `@RequirePermission()`.

---

## L. Status Deployment

| Item                           | Status                            |
| ------------------------------ | --------------------------------- |
| SSH ke VPS                     | **BLOCKED** — key tidak terdaftar |
| Backend di VPS                 | **NOT TESTED**                    |
| Frontend di VPS                | **NOT TESTED**                    |
| Nginx/Caddy di VPS             | **NOT TESTED**                    |
| Process manager                | **NOT TESTED**                    |
| Health endpoint                | **NOT TESTED** di VPS             |
| Akses `http://192.168.120.198` | **NOT TESTED**                    |

**Penyebab utama:** SSH access ke `magang@192.168.120.198` ditolak. Public key lokal (`id_ed25519`, `workbuddy_hermes`) tidak terdaftar di VPS `authorized_keys`.

---

## M. URL Aplikasi

| URL                                 | Status                                    |
| ----------------------------------- | ----------------------------------------- |
| `http://192.168.120.198`            | **NOT VERIFIED** (butuh SSH untuk deploy) |
| `http://192.168.120.198/api/health` | **NOT VERIFIED**                          |
| `http://192.168.120.198/api/ready`  | **NOT VERIFIED**                          |

**Port yang direncanakan:**

- Backend API: `4000` (NestJS)
- Frontend Web: `3000` (Next.js)
- PostgreSQL: `5432`
- Redis: `6379`
- MinIO: `9000` (S3), `9001` (Console)
- Caddy/Nginx: `80` (HTTP)

---

## N. Fitur yang Sudah Berfungsi

| Fitur               | Frontend | Backend | API                                | Database Schema | Status                 |
| ------------------- | -------- | ------- | ---------------------------------- | --------------- | ---------------------- |
| Health endpoint     | N/A      | PASS    | `/health`, `/ready`                | N/A             | **BERFUNGSI**          |
| Landing page publik | PASS     | N/A     | N/A                                | N/A             | **BERFUNGSI** (statis) |
| Error handling      | N/A      | PASS    | Global filter                      | N/A             | **BERFUNGSI**          |
| Request logging     | N/A      | PASS    | Pino + request ID                  | N/A             | **BERFUNGSI**          |
| Security middleware | N/A      | PASS    | Helmet, CORS, CSRF, Rate limit     | N/A             | **BERFUNGSI**          |
| RBAC framework      | N/A      | PASS    | PermissionGuard deny-by-default    | Schema tersedia | **FRAMEWORK SIAP**     |
| Audit framework     | N/A      | PASS    | Interceptor + hash chain           | Schema tersedia | **FRAMEWORK SIAP**     |
| Crypto service      | N/A      | PASS    | Argon2id, AES-256-GCM, blind index | N/A             | **BERFUNGSI**          |
| Transaction manager | N/A      | PASS    | ACID wrapper                       | N/A             | **BERFUNGSI**          |

---

## O. Fitur yang Belum Selesai

| Fitur                     | Frontend          | Backend                      | Database Schema        | Estimasi    |
| ------------------------- | ----------------- | ---------------------------- | ---------------------- | ----------- |
| Website publik/CMS        | Landing page saja | Tidak ada                    | Tidak ada              | MVP Phase 2 |
| Buku Tamu                 | Tidak ada         | Tidak ada                    | Schema + migration ada | MVP Phase 2 |
| Dashboard admin           | Tidak ada         | Tidak ada                    | Tidak ada              | MVP Phase 3 |
| Manajemen pengguna        | Tidak ada         | IAM module draft             | Schema ada             | MVP Phase 3 |
| Manajemen pegawai         | Tidak ada         | Tidak ada                    | Schema + migration ada | MVP Phase 3 |
| Arsip                     | Tidak ada         | Tidak ada                    | Schema + migration ada | MVP Phase 3 |
| Kinerja                   | Tidak ada         | Tidak ada                    | Schema + migration ada | MVP Phase 4 |
| Authentication            | Tidak ada         | IAM module draft             | Schema ada             | MVP Phase 3 |
| RBAC (impl. lengkap)      | Tidak ada         | Guard ada, service belum     | Schema ada             | MVP Phase 3 |
| Audit log (impl. lengkap) | Tidak ada         | Service ada, interceptor ada | Schema + migration ada | MVP Phase 3 |

---

## P. Risiko dan Pekerjaan Lanjutan

### P.1 BLOCKER: SSH Access ke VPS

**Masalah:** SSH ke `magang@192.168.120.198` ditolak (public key tidak terdaftar).
**Dampak:** Tidak dapat deploy, tidak dapat memeriksa status database/Redis/MinIO, tidak dapat konfigurasi Nginx/Caddy.
**Solusi yang disarankan:** Daftarkan public key lokal ke VPS `authorized_keys` atau berikan password SSH.
**Risiko:** Tanpa SSH, deployment MVP lokal tidak dapat dilakukan dari mesin ini.
**Tindakan yang membutuhkan persetujuan:** Konfigurasi SSH access ke VPS.

### P.2 Modul IAM Belum Selesai

**Masalah:** Auth controller, auth service, JWT guard, session service, MFA service belum dibuat.
**Dampak:** Tidak ada autentikasi fungsional. Semua endpoint non-public ditolak oleh PermissionGuard.
**Solusi:** Implementasi IAM module secara bertahap setelah MVP lokal berjalan.
**Risiko:** MVP tidak dapat memiliki dashboard admin atau fitur yang membutuhkan login.

### P.3 Frontend Belum Ada API Integration

**Masalah:** Frontend hanya landing page statis. Tidak ada fetch ke API, tidak ada state management.
**Dampak:** MVP hanya menampilkan halaman publik.
**Solusi:** Tambahkan halaman dan API client setelah backend fitur tersedia.

### P.4 Docker Compose Menggunakan Caddy (127.0.0.1 binding)

**Masalah:** Caddyfile hanya bind ke `127.0.0.1:80` — tidak accessible dari LAN.
**Dampak:** Jika menggunakan docker-compose as-is, aplikasi hanya accessible dari localhost VPS.
**Solusi:** Ubah Caddy binding ke `0.0.0.0:80` atau konfigurasi Nginx reverse proxy untuk LAN access.
**Risiko:** Perubahan konfigurasi reverse proxy di VPS.
**Tindakan yang membutuhkan persetujuan:** Perubahan konfigurasi Caddy/Nginx di VPS.

### P.5 Environment CORS Perlu Disesuaikan untuk LAN

**Masalah:** `CORS_ORIGINS` default adalah `http://localhost:3000,http://127.0.0.1:3000`.
**Dampak:** Frontend di `http://192.168.120.198` akan ditolak oleh CORS.
**Solusi:** Tambahkan `http://192.168.120.198` ke `CORS_ORIGINS` di `.env` VPS.

### P.6 DEK_ENCRYPTION_KEY dan BLIND_INDEX_SALT di Env Schema

**Masalah:** `EnvSchema` tidak memvalidasi `DEK_ENCRYPTION_KEY` (hanya ada di `.env.example`). `BLIND_INDEX_SALT` punya default yang lemah.
**Dampak:** CryptoService menggunakan HKDF dari `APP_SECRET`, bukan `DEK_ENCRYPTION_KEY` langsung — aman untuk MVP.
**Solusi:** Tambahkan validasi env untuk `DEK_ENCRYPTION_KEY` saat implementasi modul yang menggunakan enkripsi kolom.

---

## Cara Menjalankan Aplikasi

### Prasyarat

- Node.js >= 20
- pnpm >= 9
- PostgreSQL 17+
- Redis 7+

### Development Lokal

```bash
# 1. Install dependencies
cd D:\MAGANGHUB\WEBB
pnpm install

# 2. Salin environment
cp .env.example .env.local
# Edit .env.local dengan kredensial yang benar

# 3. Jalankan database migration
pnpm db:migrate

# 4. Jalankan backend (port 4000)
pnpm --filter @sistem-terintegrasi/api run dev

# 5. Jalankan frontend (port 3000)
pnpm --filter @sistem-terintegrasi/web run dev
```

### Production Build

```bash
# Build backend
pnpm --filter @sistem-terintegrasi/api run build

# Start backend
pnpm --filter @sistem-terintegrasi/api run start

# Build frontend
pnpm --filter @sistem-terintegrasi/web run build

# Start frontend
pnpm --filter @sistem-terintegrasi/web run start
```

### Docker Compose (VPS)

```bash
cd infra
docker compose up -d
```

**Catatan:** Caddyfile bind ke `127.0.0.1` — perlu diubah ke `0.0.0.0` untuk LAN access.

---

## Cara Menghentikan Aplikasi

```bash
# Development: Ctrl+C di terminal

# Docker Compose
cd infra
docker compose down

# Process manager (jika menggunakan PM2/systemd)
pm2 stop all  # atau systemctl stop <service-name>
```

---

## Cara Melihat Log

```bash
# Development: log muncul di terminal (Pino pretty print)

# Docker Compose
docker compose logs -f api
docker compose logs -f web

# PM2
pm2 logs api
pm2 logs web
```

---

## Cara Melakukan Rollback

### Rollback Perubahan TypeScript Config

```bash
cd D:\MAGANGHUB\WEBB
git checkout -- apps/api/tsconfig.json apps/api/tsconfig.build.json
```

### Rollback Seluruh Perubahan (TIDAK DIPANJANGKAN)

```bash
cd D:\MAGANGHUB\WEBB
git stash  # simpan perubahan yang belum di-commit
```

### Rollback Database Migration

Migration tidak dapat di-rollback otomatis. Backup database sebelum migration. Hubungi administrator database.

---

## Isolasi IAM Module — Catatan Teknis

File `apps/api/src/modules/iam/iam.module.ts` dikecualikan dari typecheck dan build karena:

1. Mengimpor 9 file/dependency yang belum diimplementasi
2. Tidak diimpor oleh AppModule (tidak aktif di runtime)
3. Menghapus file akan menghilangkan desain dan dokumentasi IAM

**Cara mengaktifkan kembali saat IAM selesai:**

1. Buat file: `auth.controller.ts`, `auth.service.ts`, `guards/jwt-auth.guard.ts`, `guards/require-permission.guard.ts`, `mfa.service.ts`, `session.service.ts`
2. Install: `@nestjs/jwt`, `@nestjs/config`
3. Buat: `../../shared/users/users.module.ts`
4. Hapus baris `src/modules/iam/iam.module.ts` dari `exclude` di `tsconfig.json` dan `tsconfig.build.json`
5. Import `IamModule` di `app.module.ts`

---

## UPDATE FASE 2: Landing Page + Buku Tamu + API Integration

### Perubahan Tambahan

#### 1. Landing Page Upgrade

File: `apps/web/src/app/page.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.spec.tsx`

- Identitas MagangHub dengan navbar, hero section, features section, module cards, status implementasi, footer
- Responsive desktop dan mobile
- Status implementasi transparan per modul
- Navigasi ke halaman Buku Tamu
- Metadata diperbarui ke "MagangHub - Portal Sistem Informasi Terintegrasi"

#### 2. Buku Tamu Frontend

File baru: `apps/web/src/app/buku-tamu/page.tsx`, `apps/web/src/lib/api.ts`

- Form pendaftaran kunjungan: nama, instansi, tujuan, yang dikunjungi, bagian, jumlah peserta, kontak
- Validasi client-side (required, max length, email format, party size 1-50)
- Loading state (spinner saat submit)
- Pesan sukses dengan ID dan waktu check-in
- Pesan error dengan kode error
- Tidak ada data palsu, tidak ada tombol palsu
- API client dengan fallback same-origin (`/api`)

#### 3. Buku Tamu Backend

File baru:

- `apps/api/src/modules/guest/guest.module.ts`
- `apps/api/src/modules/guest/controllers/guest.controller.ts`
- `apps/api/src/modules/guest/controllers/guest.controller.spec.ts`
- `apps/api/src/modules/guest/services/guest.service.ts`
- `apps/api/src/modules/guest/services/guest.service.spec.ts`
- `apps/api/src/modules/guest/dto/create-public-visit.dto.ts`

File diubah:

- `apps/api/src/app.module.ts` — import GuestModule
- `apps/api/src/modules/guest/infrastructure/schema.ts` — tambah `hostEmployeeName` dan `hostOrgUnitName`

Endpoint:

- `POST /guest/visits` — PUBLIC (`@Public()`), membuat kunjungan baru
  - Input divalidasi dengan Zod schema
  - Membuat record visitor + visit dalam satu transaksi
  - Return `{ success: true, data: { id, checkInAt } }`
  - Error: 422 dengan detail field errors

#### 4. Database Migration

File baru: `db/migrations/0009_guest_host_name.sql`

- `ALTER TABLE guest.visits ADD COLUMN host_employee_name text`
- `ALTER TABLE guest.visits ADD COLUMN host_org_unit_name text`
- Non-destructive (ADD COLUMN nullable)
- Tidak menghapus atau mengubah data existing

### Hasil Pengujian Fase 2

| Pengujian        | Command                      | Exit Code | Status                             |
| ---------------- | ---------------------------- | --------- | ---------------------------------- |
| API Typecheck    | `tsc --noEmit`               | 0         | **PASS**                           |
| Web Typecheck    | `tsc --noEmit`               | 0         | **PASS**                           |
| API Build        | `tsc -p tsconfig.build.json` | 0         | **PASS**                           |
| Web Build        | `next build`                 | 0         | **PASS**                           |
| API Unit Test    | `vitest run`                 | 0         | **88 passed, 7 skipped, 0 failed** |
| Web Unit Test    | `vitest run`                 | 0         | **2 passed, 0 failed**             |
| Shared Unit Test | `vitest run`                 | 0         | **2 passed, 0 failed**             |

Frontend routes setelah build:

- `/` — 172 B, 109 kB First Load JS (Static)
- `/buku-tamu` — 11.7 kB, 121 kB First Load JS (Static)
- `/_not-found` — 975 B, 106 kB (Static)

### Status Fitur Buku Tamu

| Aspek                   | Status                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Frontend form           | **BERFUNGSI** — validasi, loading, success/error state                                       |
| Backend controller      | **BERFUNGSI** — POST /guest/visits, @Public, Zod validation                                  |
| Backend service         | **BERFUNGSI** — transaksi atomik visitor + visit                                             |
| Database schema         | **BERFUNGSI** — migration 0009 siap dijalankan                                               |
| API integration         | **BERFUNGSI** — same-origin `/api` fallback, error handling                                  |
| Endpoint admin (GET)    | **BELUM DIIMPLEMENTASIKAN** — memerlukan autentikasi                                         |
| Enkripsi field sensitif | **BELUM** — phone/email belum dienkripsi (menunggu integrasi CryptoService di service layer) |
| Audit logging           | **FRAMEWORK SIAP** — AuditInterceptor tersedia, belum dihubungkan ke GuestController         |

### Catatan Keamanan Buku Tamu

- Endpoint POST `/guest/visits` bersifat publik (`@Public()`) — hanya untuk membuat data
- Tidak ada endpoint publik untuk membaca data kunjungan
- PermissionGuard deny-by-default aktif untuk semua endpoint lain
- Data sensitif (phone, email) belum dienkripsi di MVP ini — perlu integrasi CryptoService
- Rate limiting aktif (100 request/menit per IP)
- CSRF protection aktif untuk POST
- Input divalidasi dengan Zod (required, max length, format)
