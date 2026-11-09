# Sistem Terintegrasi: Buku Tamu, Kinerja, Kepegawaian, Arsip

Status: **DRAFT rancangan teknis**. Belum ada kode aplikasi; implementasi dimulai setelah rancangan ini disetujui.

## Isi dokumentasi

| Dokumen                                                  | Isi                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [01-arsitektur.md](01-arsitektur.md)                     | Stack, struktur repo & modul, alur permintaan, laptop -> VPS, keputusan yang perlu persetujuan |
| [02-erd.md](02-erd.md)                                   | Konvensi data, ERD per modul (Mermaid), aturan data, kamus istilah, pertanyaan terbuka         |
| [03-keamanan.md](03-keamanan.md)                         | Autentikasi, otorisasi, enkripsi, file, audit, infrastruktur, daftar periksa produksi          |
| [04-panduan-pengembangan.md](04-panduan-pengembangan.md) | Cara menambah fitur/modul, migrasi, pengujian, ADR, perawatan dokumentasi                      |
| [../db/schema.sql](../db/schema.sql)                     | Skema PostgreSQL lengkap (sumber kebenaran struktur data)                                      |

## Modul

- **iam / core**: pengguna, peran, izin, unit organisasi, sesi, MFA, file, audit
- **hr**: pegawai, riwayat jabatan, keluarga, pendidikan, cuti
- **perf**: siklus, sasaran, progres, penilaian
- **archive**: dokumen, versi, klasifikasi & retensi, disposisi, pemusnahan
- **guest**: tamu, janji temu, kunjungan

## Cara membaca diagram

Diagram memakai Mermaid; tampil otomatis di GitHub/GitLab, VS Code (ekstensi Markdown Preview Mermaid), atau https://mermaid.live.
