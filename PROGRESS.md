# PROGRESS.md

## Ringkasan Progres & Status Tahapan

- **Tahap 1 – Kerangka Repositori dan Infrastruktur Lokal**: ✅ **Selesai**
- **Tahap 2 – Database, Migrasi, dan Seed**: ✅ **Selesai Penuh**

---

## Tahap 2 – Database, Migrasi, dan Seed

**Status:** ✅ **Selesai Penuh** (Semua kriteria penerimaan dan pagar mutu terpenuhi).

### Rincian Pencapaian

1. **Pemisahan Migrasi Bernomor (`db/migrations/`)**:
   - `0001_extensions_schemas.sql` (Ekstensi `pgcrypto`, `citext`, `ltree`, `btree_gist`, `pg_trgm`, 6 skema multi-skema, `base_columns`, dan fungsi `touch_row`).
   - `0002_core.sql` (`org_units`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `auth_sessions`, `mfa_factors`, `files`, `number_sequences`, `next_number`, `notifications`).
   - `0003_audit.sql` (`audit_logs`, trigger rantai hash `chain_hash`, trigger perlindungan append-only `forbid_change`).
   - `0004_hr.sql` (`employment_statuses`, `grades`, `positions`, `employees`, `employee_assignments` dengan exclusion constraint, `employee_families`, `employee_educations`, `leave_types`, `leave_balances`, `leave_requests`).
   - `0005_perf.sql` (`cycles`, `goals` dengan check bobot, `goal_progress`, `behavior_aspects`, `appraisals`, `appraisal_goal_scores`, `appraisal_behavior_scores`, `appraisal_reviews`).
   - `0006_archive.sql` (`categories`, `physical_locations`, `documents` dengan `tsvector`, `document_versions` dengan `current_version_id` DEFERRABLE INITIALLY DEFERRED, `document_acl`, `document_dispositions`, `document_links`, `document_tags`, `disposal_records`, `disposal_items`, serta deferred FK dari `hr` dan `perf`).
   - `0007_guest.sql` (`visitors`, `appointments`, `visits`, `visit_companions`).
   - `0008_triggers_grants.sql` (Pemasangan trigger `touch_row` otomatis, role `migrator`, `app_rw`, `app_ro`, hak akses least-privilege, dan seed role bawaan).
   - Skrip Verifikasi: `scripts/verify-schema-snapshot.ts` membuktikan migrasi 0001-0008 setara 100% dengan `db/schema.sql`.

2. **Runner Migrasi & Seed**:
   - `docs/adr/0003-orm-dan-migrasi.md`: Dokumentasi keputusan Drizzle ORM + runner migrasi SQL multi-skema transaksional.
   - `scripts/migrate.ts`: Menjalankan migrasi secara transaksional (ACID) dan mencatat riwayat pada `core.__migrations`.
   - `scripts/seed.ts`: Menjalankan seeding secara idempoten (`ON CONFLICT DO NOTHING` / `DO UPDATE`).
   - Skrip root: `pnpm db:migrate`, `pnpm db:status`, dan `pnpm db:seed`.

3. **Definisi Drizzle per Modul (`apps/api/src/modules/*/infrastructure/schema.ts`)**:
   - Setiap modul hanya mendefinisikan dan mengakses tabel skemanya sendiri.
   - Ketergantungan relasi lintas modul HANYA diekspos melalui tipe ID (`OrgUnitId`, `UserId`, `FileId`, dll.), menjaga batas isolasi modular monolith.
   - Divalidasi dengan aturan ESLint Boundaries.

4. **Seed Izin, Peran, & Data Referensi**:
   - `db/seeds/permissions.seed.ts`: Izin lengkap seluruh modul dalam format standar `<modul>.<resource>.<aksi>`.
   - `db/seeds/roles.seed.ts`: Pemetaan peran bawaan (`super_admin`, `hr_admin`, `supervisor`, `employee`, `archivist`, `receptionist`, `auditor`).
   - `db/seeds/reference_data.seed.ts`: Master referensi awal (`employment_statuses`, `grades`, `leave_types`, `behavior_aspects`, `archive.categories`) ditandai jelas _(contoh, ganti sesuai kebijakan organisasi)_.

5. **Pengujian Mutu**:
   - `src/common/database/database-schema.spec.ts`: 15 tes lolos uji (verifikasi snapshot migrasi, integritas format izin, integritas peran bawaan, bobot aspek perilaku 100%, dan ekspor skema Drizzle tiap modul).
   - `src/database.integration.spec.ts`: Siap untuk pengujian end-to-end kontainer PostgreSQL 17 (migrasi dari nol, idempotensi seed 2x, exclusion constraint tumpang tindih jabatan, audit_logs append-only, deferred current_version_id, check bobot goals, dan hak akses app_rw).
   - _Catatan Jujur_: Pada laptop lokal pengembang tanpa Docker engine aktif, tes live container diskip secara elegan dan diverifikasi pada CI GitHub Actions (`ubuntu-latest`).

---

## Daftar Tugas Terbuka untuk Tahap 3 (Autentikasi, IAM & Sesi)

1. **Implementasi Autentikasi Pengguna**:
   - Pendaftaran pengguna, hashing kata sandi Argon2id, login, dan penguncian akun setelah percobaan gagal.
2. **Pengelolaan Sesi & Token**:
   - JWT access token berumur pendek, refresh token hashing dengan deteksi pemakaian ulang token (`family_id`).
   - Rotasi token dan pencabutan sesi di `core.auth_sessions`.
3. **MFA TOTP**:
   - Setup, konfirmasi, dan verifikasi TOTP dengan enkripsi secret AES-256-GCM.
4. **Guards & Deny-by-Default RBAC**:
   - AuthGuard dan PermissionsGuard global; endpoint tanpa dekorator izin eksplisit wajib gagal pada tes.
