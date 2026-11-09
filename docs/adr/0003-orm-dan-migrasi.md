# ADR-0003: Pemilihan ORM dan Strategi Migrasi Multi-Skema PostgreSQL

**Status:** Diterima  
**Tanggal:** 2026-11-09

## Konteks

Sistem Terintegrasi dibangun dengan arsitektur **Modular Monolith** berstandar keamanan tinggi dan memiliki 6 skema terpisah di PostgreSQL 17+:

1. `core`: Pengguna, autentikasi, sesi, peran, izin, file, unit organisasi.
2. `hr`: Kepegawaian, jabatan, riwayat penempatan, keluarga, pendidikan, cuti.
3. `perf`: Siklus kinerja, sasaran (SKP/OKRs), progres, penilaian, aspek perilaku.
4. `archive`: Klasifikasi arsip, naskah dinas, disposisi, retensi, berita acara pemusnahan.
5. `guest`: Buku tamu, pra-registrasi, kunjungan fisik, lencana.
6. `audit`: Log jejak audit tamper-evident append-only dengan rantai hash sha256.

Tantangan arsitektural:

- Setiap modul hanya boleh mengakses tabel dalam skemanya sendiri (ditegakkan via batas modular).
- Terdapat ekstensi PostgreSQL khusus (`ltree`, `btree_gist`, `citext`, `pgcrypto`, `pg_trgm`) dan fitur database tingkat lanjut seperti exclusion constraints (`EXCLUDE USING gist`), trigger berantai hash, dan fungsi PL/pgSQL.
- Dibutuhkan runner migrasi yang mendukung eksekusi file SQL murni secara berurutan, transaksional (ACID), dan idempoten.

## Keputusan

1. **Akses Data Aplikasi: Drizzle ORM**
   - **Alasan Pemilihan:**
     - Drizzle ORM menyediakan _type-safe SQL_ yang transparan tanpa _runtime overhead_ yang berat (seperti Prisma engine) atau _magic tracking state_ (seperti TypeORM).
     - Drizzle mendukung pemisahan skema secara native (`pgSchema('hr')`, `pgSchema('core')`, dll.), memungkinkan tiap modul mendefinisikan skema secara mandiri di `apps/api/src/modules/<modul>/infrastructure/schema.ts` tanpa saling mengimpor tabel.
     - Penulisan query SQL deklaratif sangat selaras dengan kebutuhan performa dan transparansi query audit.

2. **Strategi Migrasi: SQL Migration Runner Transaksional Mandiri**
   - **Alasan Pemilihan:**
     - Migrasi skema didefinisikan dalam berkas SQL bernomor di `db/migrations/` (`0001_extensions_schemas.sql`, `0002_core.sql`, dst.).
     - Berkas SQL murni memberikan kontrol penuh atas fitur khusus PostgreSQL 17 (seperti `EXCLUDE USING gist`, `DEFERRABLE INITIALLY DEFERRED`, trigger PL/pgSQL, dan privilege `GRANT`/`REVOKE`) yang sulit atau tidak dapat digenerate secara akurat oleh ORM migration generator otomatis.
     - Runner migrasi mengeksekusi setiap berkas SQL di dalam transaksi database dan mencatat statusnya pada tabel `core.__migrations`.
     - Snapshot `db/schema.sql` dipertahankan sebagai acuan terpusat, dengan pengujian otomatis (`scripts/verify-schema-snapshot.ts`) untuk menjamin konsistensi.

3. **Strategi Seeding: Seed Script Idempoten**
   - Berkas seed di `db/seeds/` dipecah berdasarkan domain (`permissions`, `roles`, `reference_data`).
   - Setiap operasi seed wajib menggunakan `ON CONFLICT DO NOTHING` atau `ON CONFLICT DO UPDATE` agar aman dijalankan berulang kali.

## Konsekuensi

### Positif:

- **Pemisahan Modul Terjaga:** Tidak ada ketergantungan antar-modul pada layer schema TypeScript.
- **Dukungan PostgreSQL Penuh:** Tidak ada kompromi pada constraint lanjutan (`btree_gist`, `audit tamper-evident`, dll.).
- **Performa & Jejak Memori Rendah:** Drizzle ringan dan cepat di lingkungan produksi.
- **Transparansi:** Seluruh struktur database terdokumentasi jelas dalam SQL murni yang dapat ditinjau DBA atau pengembang.

### Risiko & Mitigasi:

- **Kebutuhan Menjaga Sinkronisasi Skema TypeScript dengan SQL:**
  - _Mitigasi:_ Setiap perubahan pada berkas migrasi SQL wajib diikuti pembaruan definisi schema Drizzle di modul terkait dan diverifikasi melalui unit/integration test.
