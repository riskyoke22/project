# Panduan Pengembangan

## 1. Alur kerja harian

1. Ambil isu/tugas; cek apakah menyentuh **skema database** (-> butuh migrasi) atau **izin** (-> butuh seed izin).
2. Buat cabang `fitur/<modul>-<ringkas>`.
3. Kerjakan di dalam modul terkait; jangan menyentuh tabel modul lain.
4. Jalankan lint + tes lokal; buka Pull Request memakai templat (bagian 6).
5. Review (wajib untuk `iam`, `crypto`, `audit`, migrasi), lalu gabung.

## 2. Menambah fitur: contoh "izin tidak masuk kerja" di modul hr

| Langkah                      | Tempat                                                           | Catatan                                                        |
| ---------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Rancang data              | `db/migrations/0007_hr_absence.sql`                              | Tabel baru memakai `LIKE core.base_columns`; index; constraint |
| 2. Perbarui dokumentasi data | `docs/02-erd.md`                                                 | Diagram modul + aturan data penting                            |
| 3. Tambah izin               | `packages/shared/permissions.ts` + `db/seeds/`                   | Format `hr.absence.read/create/approve`                        |
| 4. Skema Zod                 | `packages/shared/hr/absence.ts`                                  | Dipakai API dan form                                           |
| 5. Logika                    | `modules/hr/domain/` lalu `application/`                         | Aturan murni dulu (mudah diuji), baru use case + transaksi     |
| 6. Akses data                | `modules/hr/infrastructure/absence.repository.ts`                | Hanya skema `hr`                                               |
| 7. API                       | `modules/hr/api/absence.controller.ts`                           | Dekorator izin wajib; DTO tervalidasi                          |
| 8. Audit                     | interceptor otomatis; tambahkan `AuditAction` bila khusus        | Data sensitif dimasking                                        |
| 9. Antarmuka                 | `apps/web/app/(app)/hr/absence/`                                 | Gunakan komponen bersama                                       |
| 10. Tes                      | unit (domain), integrasi (repository + DB uji), e2e (alur utama) | Sertakan tes akses ditolak                                     |
| 11. Dokumentasi modul        | `modules/hr/README.md`                                           | Tabel, izin, event yang bertambah                              |

Menambah **modul baru** (mis. `payroll`): salin pola struktur modul di `01-arsitektur.md` bagian 3, buat skema `payroll`, daftarkan modul, tambahkan baris di tabel ketergantungan, tulis ADR bila ada keputusan besar.

## 3. Aturan migrasi database

- Bernomor berurutan, **tidak pernah mengedit migrasi yang sudah dirilis**; koreksi = migrasi baru.
- Dua langkah untuk perubahan berisiko (expand -> migrate data -> contract) agar rilis tanpa downtime.
- Setiap migrasi menyertakan catatan dampak dan cara rollback (atau alasan tidak bisa).
- Uji migrasi pada salinan data sebelum produksi.
- Setelah migrasi besar, perbarui snapshot `db/schema.sql` dan `docs/02-erd.md`.

## 4. Konvensi kode

- TypeScript `strict`; tanpa `any` tanpa komentar alasan.
- Nama berkas `kebab-case`; kelas `PascalCase`; variabel `camelCase`; kolom DB `snake_case`.
- Controller tipis: validasi + panggil use case. Logika bisnis di `application/domain`.
- Transaksi dimulai di use case, bukan di repository.
- Galat bisnis memakai kelas galat domain dengan kode stabil (`LEAVE_BALANCE_INSUFFICIENT`) agar UI dapat menerjemahkan.
- Tidak ada rahasia, NIK, atau token di log.
- Komentar menjelaskan _mengapa_, bukan _apa_.
- Teks antarmuka di berkas i18n (default Indonesia) agar mudah diubah.

## 5. Strategi pengujian

| Tingkat     | Cakupan                                                                 | Alat                |
| ----------- | ----------------------------------------------------------------------- | ------------------- |
| Unit        | Aturan `domain/` (saldo cuti, bobot nilai, retensi)                     | Vitest/Jest         |
| Integrasi   | Repository + use case terhadap PostgreSQL asli (kontainer uji)          | Testcontainers      |
| Kontrak API | Respons sesuai skema Zod                                                | Vitest + supertest  |
| Keamanan    | Endpoint tanpa izin gagal; IDOR; rate limit; unggah berbahaya           | Tes khusus + CodeQL |
| E2E         | Login+MFA, ajukan & setujui cuti, unggah & unduh dokumen, check-in tamu | Playwright          |

Syarat gabung: lint, tipe, tes lulus; migrasi dapat naik dari nol dan dari rilis sebelumnya.

## 6. Templat Pull Request

```
## Tujuan
## Perubahan data (migrasi? ERD diperbarui?)
## Izin baru / berubah
## Dampak keamanan (data sensitif? akses? file?)
## Cara uji
## Dokumentasi yang diperbarui
```

## 7. Templat ADR (`docs/adr/NNNN-judul.md`)

```
# ADR-NNNN: Judul
Status: Usulan | Diterima | Digantikan oleh ADR-XXXX
Tanggal:
## Konteks
## Keputusan
## Alternatif yang dipertimbangkan
## Konsekuensi (positif, negatif, risiko)
```

## 8. Dokumentasi yang harus dirawat

| Dokumen                                                              | Pemilik                       | Diperbarui saat           |
| -------------------------------------------------------------------- | ----------------------------- | ------------------------- |
| `docs/02-erd.md` + `db/schema.sql`                                   | Siapa pun yang mengubah skema | Setiap migrasi            |
| `modules/*/README.md`                                                | Pemilik modul                 | Tabel/izin/event berubah  |
| `docs/03-keamanan.md`                                                | Penanggung jawab keamanan     | Kontrol baru, temuan uji  |
| `docs/adr/`                                                          | Pengusul keputusan            | Keputusan arsitektur baru |
| Dokumentasi API (OpenAPI dari NestJS)                                | Otomatis                      | Setiap build              |
| Runbook operasional (`infra/`): backup, pulih, rotasi kunci, insiden | Pengelola infrastruktur       | Prosedur berubah          |

## 9. Menyiapkan lingkungan laptop (setelah rancangan disetujui)

Prasyarat: Docker Desktop/Engine, Node LTS, pnpm. Langkah:

1. `cp .env.example .env.local` lalu isi nilai dummy (kunci enkripsi dibuat dengan skrip, bukan ditulis tangan).
2. `docker compose up -d` (postgres, redis, minio, clamav).
3. `pnpm install && pnpm db:migrate && pnpm db:seed`.
4. `pnpm dev` (web + api).

Isi detail akan disesuaikan saat scaffolding.
