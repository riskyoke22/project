# Arsitektur

Status: DRAFT rancangan teknis untuk disetujui sebelum ada kode. Versi pasti setiap pustaka dikunci (lockfile) dan diverifikasi saat scaffolding, bukan di dokumen ini.

## 1. Prinsip

1. **Modular monolith**, bukan microservices. Satu aplikasi, satu database, batas modul yang tegas. Cocok untuk satu organisasi, tim kecil, dan satu VPS; bisa dipecah nanti bila memang perlu.
2. **Keamanan sebagai bawaan**, bukan tahap akhir (lihat `03-keamanan.md`).
3. **Skema database adalah kontrak**; perubahan hanya lewat migrasi bernomor.
4. **Portabel**: seluruh sistem berjalan dengan Docker Compose, sama persis di laptop dan VPS.
5. **Terdokumentasi dekat dengan kode**: setiap modul punya `README.md`, keputusan besar dicatat sebagai ADR.

## 2. Tumpukan teknologi (rekomendasi)

| Lapisan                    | Pilihan                                                                               | Alasan singkat                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Frontend                   | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zod | Ekosistem terbesar, SSR/BFF untuk cookie aman, komponen UI cepat dibuat                      |
| Backend API                | NestJS (TypeScript)                                                                   | Modul, DI, guard, dan interceptor bawaan: cocok untuk RBAC, audit, dan batas modul yang rapi |
| Validasi & kontrak         | Zod di `packages/shared`, dipakai frontend dan backend                                | Satu definisi tipe untuk form dan API                                                        |
| Database                   | PostgreSQL 17+                                                                        | Constraint kuat, `ltree`, full-text, exclusion constraint, row-level security                |
| Akses data                 | Drizzle ORM + migrasi SQL                                                             | Tipe aman, dekat dengan SQL, mendukung multi-skema                                           |
| Cache, antrean, rate limit | Redis + BullMQ                                                                        | Job terjadwal (retensi, anonimisasi, pemindaian file, notifikasi)                            |
| Penyimpanan file           | MinIO (S3-compatible)                                                                 | Mudah pindah ke S3/penyimpanan lain; presigned URL berumur pendek                            |
| Pemindai berkas            | ClamAV (kontainer)                                                                    | Semua unggahan dipindai sebelum dapat diunduh                                                |
| Reverse proxy              | Caddy                                                                                 | HTTPS otomatis (VPS), konfigurasi singkat, header keamanan                                   |
| Observability              | pino (log JSON), OpenTelemetry, health endpoint; Prometheus/Grafana opsional          | Mudah dilacak per `request_id`                                                               |
| Kualitas                   | ESLint (+ boundaries), Prettier, Vitest/Jest, Playwright, Husky                       | Batas modul ditegakkan otomatis                                                              |
| CI                         | GitHub Actions: lint, test, CodeQL, `npm audit`, Trivy, build image                   | Keamanan rantai pasok sejak awal                                                             |

Alternatif yang masuk akal: Laravel bila tim Anda lebih kuat di PHP. Struktur modul, skema, dan keamanan di dokumen ini tetap berlaku; yang berubah hanya lapisan kode. Keputusan final dicatat di ADR-0002.

## 3. Struktur repositori

```
sistem-terintegrasi/
├─ apps/
│  ├─ web/                  # Next.js (UI + BFF)
│  └─ api/                  # NestJS
│     └─ src/
│        ├─ main.ts, app.module.ts
│        ├─ common/         # guard, interceptor, filter, crypto, audit, config
│        └─ modules/
│           ├─ iam/         # login, MFA, RBAC, pengguna, unit organisasi
│           ├─ hr/          # kepegawaian
│           ├─ perf/        # kinerja
│           ├─ archive/     # arsip & dokumen
│           ├─ guest/       # buku tamu
│           ├─ files/       # unggah, pindai, unduh (dipakai semua modul)
│           └─ audit/       # penulis & pembaca jejak audit
├─ packages/
│  ├─ shared/               # skema Zod, tipe, konstanta izin
│  └─ config/               # tsconfig, eslint bersama
├─ db/
│  ├─ migrations/           # 0001_init.sql, 0002_...
│  ├─ seeds/                # referensi & izin
│  └─ schema.sql            # snapshot acuan desain
├─ infra/
│  ├─ docker-compose.yml, docker-compose.prod.yml
│  ├─ caddy/Caddyfile
│  └─ backup/               # skrip backup & restore + uji pulih
└─ docs/
   ├─ README.md
   ├─ 01-arsitektur.md, 02-erd.md, 03-keamanan.md, 04-panduan-pengembangan.md
   └─ adr/                  # catatan keputusan arsitektur
```

### Struktur satu modul backend (pola seragam)

```
modules/hr/
├─ README.md                # tujuan, tabel yang dimiliki, izin, event
├─ hr.module.ts
├─ api/                     # controller + DTO (Zod) + pemetaan respons
├─ application/             # service/use case (logika bisnis, transaksi)
├─ domain/                  # aturan murni (hitung sisa cuti, validasi tumpang tindih)
├─ infrastructure/          # repository (Drizzle), mapper
├─ policies/                # aturan akses tingkat data (siapa boleh lihat siapa)
├─ events/                  # event domain yang diterbitkan/dilanggan
└─ tests/
```

Aturan batas modul (ditegakkan ESLint boundaries):

- Modul hanya membaca/menulis **tabel di skemanya sendiri**.
- Modul lain dipanggil lewat **service publik** (`HrPublicApi.getEmployee(id)`) atau **event domain** (`LeaveApproved`, `DocumentArchived`), bukan JOIN lintas skema.
- `common/` tidak boleh mengimpor dari `modules/`.

## 4. Alur permintaan

```
Browser ──HTTPS──> Caddy ──> Next.js (BFF: cookie httpOnly) ──> NestJS API
                                                                  │ Guard: autentikasi → izin → cakupan unit
                                                                  │ Pipe: validasi Zod
                                                                  │ Service: transaksi + aturan bisnis
                                                                  │ Interceptor: tulis audit_logs
                                                                  ▼
                                      PostgreSQL   Redis   MinIO   ClamAV
```

Browser tidak pernah memegang token di JavaScript: sesi berupa cookie `httpOnly; Secure; SameSite=Lax`, ditukar oleh BFF menjadi permintaan ke API.

## 5. Modul dan ketergantungan

| Modul   | Memiliki skema                              | Bergantung pada                                   |
| ------- | ------------------------------------------- | ------------------------------------------------- |
| iam     | `core` (users, roles, org_units, sesi, MFA) | audit                                             |
| files   | `core.files`                                | iam                                               |
| hr      | `hr`                                        | iam, archive (SK), files                          |
| perf    | `perf`                                      | hr, archive (bukti), iam                          |
| archive | `archive`                                   | iam, files, hr (opsional, nama pengirim internal) |
| guest   | `guest`                                     | hr (tuan rumah), iam, files                       |
| audit   | `audit`                                     | tidak bergantung pada modul bisnis                |

Urutan bangun yang disarankan: iam + audit + files -> hr -> archive -> guest -> perf (kinerja butuh data pegawai dan aturan penilaian yang masih terbuka).

## 6. Lingkungan: laptop sekarang, VPS nanti

Satu set kontainer yang sama: `caddy`, `web`, `api`, `worker`, `postgres`, `redis`, `minio`, `clamav`.

| Hal       | Laptop (pengembangan/uji)                                                                                       | VPS (produksi)                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Akses     | `localhost` saja. Bila perlu diakses rekan: Tailscale atau Cloudflare Tunnel; jangan buka port router ke laptop | Domain + HTTPS otomatis Caddy; hanya port 80/443 (dan SSH berbasis kunci) terbuka                                     |
| Rahasia   | `.env.local` (tidak masuk git); kunci enkripsi dummy                                                            | Docker secrets atau SOPS+age; kunci enkripsi unik, dicadangkan terpisah                                               |
| Data      | Data uji/anonim. **Jangan** memasukkan data pegawai nyata ke laptop tanpa disk terenkripsi                      | Data nyata; disk/volume terenkripsi                                                                                   |
| Backup    | Opsional                                                                                                        | Wajib: `pg_dump` harian + arsip WAL (atau pgBackRest) + MinIO ke penyimpanan luar (restic), dan **uji pulih berkala** |
| Pembaruan | Manual                                                                                                          | Pipeline CI -> image bertag -> `docker compose pull && up -d`, migrasi dijalankan sebelum rilis                       |

Langkah pindah ke VPS: (1) provision VPS + hardening, (2) salin `infra/` + secret, (3) `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`, (4) pulihkan dump database + sinkron bucket MinIO, (5) uji alur login, unggah, unduh, (6) arahkan DNS.

Catatan: catatan proyek Anda menyebut dua server Proxmox sedang diinventarisasi. Karena semua berjalan di Docker Compose, VM di Proxmox dapat menggantikan VPS tanpa mengubah desain; kapasitas, RPO/RTO, dan backup ditentukan setelah inventarisasi selesai.

## 7. Skalabilitas dan evolusi

- **Menambah modul** (payroll, rekrutmen, website utama/CMS): skema baru + modul baru mengikuti pola bagian 3; tidak mengubah tabel modul lain.
- **Jika satu modul harus dipisah** kelak: batas lewat service publik/event sudah ada, sehingga dapat diekstrak menjadi layanan sendiri.
- **Pencarian dokumen**: mulai dengan PostgreSQL full-text (`search_vector`, config `simple`); bila volume besar atau butuh OCR/stemming Indonesia, tambahkan mesin pencari terpisah (ADR baru).
- **Tabel audit** besar: partisi bulanan dan arsipkan partisi lama ke penyimpanan dingin.

## 8. Daftar keputusan yang perlu persetujuan

| ID       | Keputusan                                      | Rekomendasi                                           | Status        |
| -------- | ---------------------------------------------- | ----------------------------------------------------- | ------------- |
| ADR-0001 | Modular monolith                               | Disetujui sebagai arah                                | Usulan        |
| ADR-0002 | Stack TypeScript (Next.js + NestJS) vs Laravel | TypeScript                                            | Menunggu Anda |
| ADR-0003 | Drizzle ORM + migrasi SQL                      | Drizzle                                               | Usulan        |
| ADR-0004 | Auth bawaan (Argon2id + TOTP) vs Keycloak/IdP  | Bawaan dulu; siapkan antarmuka agar bisa diganti OIDC | Usulan        |
| ADR-0005 | MinIO untuk file                               | MinIO                                                 | Usulan        |

Template ADR ada di `04-panduan-pengembangan.md`.
