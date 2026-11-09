# Keamanan

Target: **OWASP ASVS Level 2** sebagai acuan uji. Dokumen ini adalah desain; tidak ada klaim sistem sudah aman sebelum diimplementasi dan diuji. Aspek hukum pelindungan data pribadi (UU No. 27 Tahun 2022) perlu ditinjau bersama bagian hukum/kepatuhan organisasi.

## 1. Autentikasi

- Kata sandi: **Argon2id**; panjang minimal 12; cek terhadap daftar kata sandi bocor (k-anonymity); tanpa aturan komposisi yang memaksa pola lemah.
- **MFA TOTP** wajib untuk peran berhak istimewa (`super_admin`, `hr_admin`, `archivist`, `auditor`), disarankan untuk semua. WebAuthn/passkey sebagai tahap berikutnya (`mfa_factors.factor_type` sudah mendukung).
- Pembatasan percobaan: penundaan bertahap + penguncian sementara (`failed_attempts`, `locked_until`) + rate limit per IP dan per akun (Redis). Pesan galat login seragam (tidak membocorkan akun ada/tidak).
- Sesi: access token singkat (10-15 menit) + **refresh token berotasi**; token disimpan sebagai hash; pemakaian ulang refresh token lama memutus seluruh `family_id` (indikasi pencurian). Cookie `httpOnly; Secure; SameSite=Lax`, tanpa token di `localStorage`.
- Timeout idle dan batas umur sesi absolut; tombol "keluar dari semua perangkat".
- Pemulihan kata sandi: tautan sekali pakai berumur pendek; tidak ada kata sandi awal bersama (`must_change_password`).

## 2. Otorisasi (tiga lapis)

1. **RBAC**: izin `modul.resource.aksi` (mis. `hr.employee.read`, `archive.document.manage`) terpasang ke peran.
2. **Cakupan unit organisasi**: `user_roles.org_unit_id` membatasi data ke unit sendiri + turunannya (query `ltree`).
3. **Aturan tingkat data (policy)**: contoh pegawai hanya melihat datanya sendiri; atasan melihat bawahan langsung; dokumen mengikuti `security_level` dan `document_acl`.

Aturan penegakan:

- Tolak secara default (deny by default): endpoint tanpa dekorator izin gagal pada uji otomatis.
- Pemeriksaan di **server**, setiap permintaan; UI hanya menyembunyikan tombol.
- Cegah IDOR: setiap query ber-ID dibatasi oleh kepemilikan/cakupan, bukan hanya ID.
- Opsional lapis pertahanan kedua: **PostgreSQL Row-Level Security** pada `archive.documents` dan `hr.employees`, memakai `SET LOCAL app.user_id` per transaksi.
- Perubahan peran/izin selalu diaudit dan idealnya perlu persetujuan kedua (4-eyes) untuk `super_admin`.

## 3. Perlindungan data

| Data                                                        | Perlindungan                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| NIK, nomor identitas tamu, telepon, email tamu, rahasia MFA | Enkripsi tingkat kolom di aplikasi: AES-256-GCM, kunci per jenis data (envelope: DEK dibungkus KEK) |
| Pencarian/dedup data terenkripsi                            | Blind index `HMAC-SHA256(kunci_terpisah, nilai_ternormalisasi)` (`*_hash`)                          |
| Kata sandi, refresh token, QR token                         | Hanya hash (Argon2id / SHA-256 untuk token acak 256-bit)                                            |
| Lalu lintas                                                 | TLS 1.2+ dari browser; antar-kontainer dalam jaringan Docker internal                               |
| Data diam                                                   | Enkripsi disk/volume (LUKS atau fitur penyedia); MinIO SSE; backup dienkripsi sebelum keluar server |
| Log                                                         | Tanpa kata sandi, token, NIK, atau isi dokumen; masking di tingkat logger                           |

Manajemen kunci: tahap awal KEK dari secret (SOPS+age / Docker secret); tahap lanjut ke Vault/KMS. Rotasi kunci didukung dengan kolom `key_id` pada payload terenkripsi (diputuskan saat implementasi crypto). **Kunci dicadangkan terpisah dari backup data**; kehilangan kunci = kehilangan data terenkripsi.

## 4. Keamanan unggah/unduh file

- Validasi ukuran, ekstensi, dan **magic bytes**; daftar tipe yang diizinkan (PDF, gambar, Office).
- Nama penyimpanan acak (`storage_key`), nama asli hanya metadata.
- Pindai ClamAV; status `pending` -> tidak dapat diunduh sampai `clean`.
- Unduh lewat **presigned URL singkat** (menit) atau stream dari API setelah cek izin; `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`; file pengguna tidak disajikan dari origin aplikasi.
- Hash `sha256` disimpan untuk integritas dan deteksi duplikat.

## 5. Perlindungan aplikasi web

- Header: `Content-Security-Policy` ketat (tanpa `unsafe-inline` bila memungkinkan), `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`.
- CSRF: SameSite + token anti-CSRF untuk metode mengubah data; verifikasi `Origin`.
- Input: validasi Zod di batas API; query berparameter (tanpa konkatenasi SQL); output di-escape oleh React; sanitasi bila ada rich text.
- CORS: daftar putih origin eksplisit.
- Rate limiting global dan per endpoint sensitif; ukuran body dibatasi.
- Endpoint publik (buku tamu pra-registrasi): CAPTCHA/Turnstile, batas laju, dan **tidak membuka daftar pegawai** (tuan rumah dipilih dari daftar terbatas/pencarian berkode).
- Galat: pesan umum ke klien, detail hanya di log dengan `request_id`.

## 6. Audit dan deteksi

- `audit.audit_logs` append-only + rantai hash (lihat `02-erd.md` bagian 8). Dicatat: autentikasi, perubahan data master, ekspor, akses data sensitif, perubahan hak akses, pemusnahan arsip.
- Peringatan untuk pola janggal: banyak gagal login, akses massal NIK, ekspor besar, login dari lokasi baru.
- Verifikasi rantai hash terjadwal; hasil dikirim ke `auditor`.
- Log aplikasi + audit dikirim ke lokasi terpisah dari server aplikasi agar tidak dapat dihapus penyerang yang menguasai aplikasi.

## 7. Privasi dan siklus hidup data

- Dasar pemrosesan dan persetujuan dicatat (`guest.visits.consent_at`); teks persetujuan versi dikelola di konfigurasi.
- Retensi otomatis: job menganonimkan data identitas tamu setelah `retention_until`; arsip mengikuti jadwal retensi `archive.categories` dan berita acara pemusnahan.
- Pegawai dapat melihat datanya sendiri; permohonan koreksi diproses lewat HR dengan jejak audit.
- Minimisasi: kumpulkan hanya kolom yang dibutuhkan; kolom opsional dibiarkan opsional.
- Ekspor data hanya untuk peran berizin, tercatat, dan (untuk data sensitif) berkata sandi/berumur pendek.

## 8. Infrastruktur dan operasional

**Laptop (sementara)**: bind layanan ke `127.0.0.1`; jangan membuka port ke internet; gunakan data uji; disk terenkripsi; kunci/secret tidak ikut git; firewall aktif.

**VPS (produksi)**:

- SSH hanya kunci publik, login root dimatikan, port non-default opsional, `fail2ban`, `unattended-upgrades`.
- Firewall (UFW/nftables): hanya 80/443 + SSH; **PostgreSQL, Redis, MinIO tidak pernah terbuka ke publik**.
- Kontainer non-root, filesystem read-only bila memungkinkan, `cap_drop: ALL`, batas sumber daya, image dipin dengan digest.
- Pembaruan keamanan rutin; pemindaian image (Trivy) di CI dan berkala.
- Backup 3-2-1 (3 salinan, 2 media, 1 di luar lokasi), dienkripsi, **uji pulih terjadwal** dengan target RPO/RTO yang disepakati.
- Pemantauan: uptime, disk, kegagalan job, sertifikat TLS.

## 9. Rantai pasok dan siklus pengembangan

- Lockfile wajib; `npm audit`/Dependabot; dependensi minimal dan terpercaya.
- CodeQL (SAST), pemindaian rahasia (gitleaks) di pre-commit dan CI.
- Review kode wajib untuk perubahan di `iam`, `common/crypto`, `audit`, dan migrasi.
- Branch dilindungi; rilis bertag; migrasi diuji pada salinan data sebelum produksi.

## 10. Model ancaman ringkas

| Ancaman                        | Mitigasi utama                                               |
| ------------------------------ | ------------------------------------------------------------ |
| Pencurian kredensial           | Argon2id, MFA, rate limit, deteksi anomali                   |
| Pencurian sesi / XSS           | Cookie httpOnly, CSP ketat, tanpa token di JS                |
| Akses data pegawai lain (IDOR) | Cakupan unit + policy + RLS opsional + uji otomatis          |
| Unggah file berbahaya          | Validasi, ClamAV, domain terpisah, `attachment`              |
| Kebocoran database/backup      | Enkripsi kolom + backup terenkripsi + kunci terpisah         |
| Penyalahgunaan orang dalam     | Prinsip hak minimum, audit berantai hash, 4-eyes untuk admin |
| Perusakan log                  | Append-only DB + salinan log di luar server + rantai hash    |
| Kehilangan data/ransomware     | Backup 3-2-1 offsite + uji pulih                             |
| Laptop hilang (fase sementara) | Disk terenkripsi, data uji saja, secret tidak di repo        |

## 11. Daftar periksa sebelum produksi

- [ ] MFA aktif untuk semua peran istimewa
- [ ] Uji penetrasi/uji ASVS L2 pada alur login, unggah, hak akses
- [ ] Semua endpoint punya izin (uji otomatis "tanpa dekorator = gagal")
- [ ] Kunci enkripsi dibuat, dicadangkan terpisah, dan prosedur rotasi diuji
- [ ] Backup dipulihkan sukses di lingkungan terpisah
- [ ] Hanya 80/443/SSH terbuka; PostgreSQL/Redis/MinIO tidak terjangkau dari luar
- [ ] Header keamanan lulus pemeriksaan; TLS A-grade
- [ ] Tinjauan hukum atas persetujuan dan retensi data pribadi
