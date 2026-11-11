# Common Foundation Module (`apps/api/src/common`)

Modul `common` menyediakan infrastruktur dan fondasi lintas modul yang dipakai oleh seluruh modul bisnis (`iam`, `hr`, `perf`, `archive`, `guest`, `files`, `audit`).

---

## 1. Komponen Utama

### A. Kriptografi & Perlindungan Data (`common/crypto`)

- **Enkripsi Kolom**: AES-256-GCM dengan envelope (DEK acak per baris yang dibungkus KEK dari konfigurasi). Payload membawa versi dan `key_id` untuk rotasi.
- **Blind Index**: HMAC-SHA256 dengan normalisasi nilai (`trim`, `toLowerCase`, penghapusan karakter pemisah/tanda baca) untuk pencarian eksak pada kolom terenkripsi (`*_hash`).
- **Hash Kata Sandi**: Argon2id (`v=19`, `m=19456`, `t=2`, `p=1`) sesuai rekomendasi OWASP.
- **Token Acak**: CSPRNG 256-bit dan hash SHA-256 (database hanya menyimpan hash token).
- **Perbandingan Konstan**: `crypto.timingSafeEqual` untuk mencegah _timing attack_.
- **Dokumentasi Lengkap**: Lihat [`docs/07-kripto.md`](file:///d:/MAGANGHUB/WEBB/docs/07-kripto.md).

### B. Konfigurasi Bertipe (`common/config`)

- `AppConfigService`: Provider konfigurasi terkelola berbasis Zod (`EnvSchema`).
- Gagal start otomatis (_fail-fast_) jika terdapat variabel lingkungan yang kurang atau tidak memenuhi syarat keamanan.
- Menegakkan aturan: **Tidak ada pemanggilan `process.env` langsung di luar modul config**.

### C. Hierarki Galat & Filter Global (`common/errors`)

- `AppError`: Kelas dasar error domain dengan kode error yang stabil (contoh: `LEAVE_BALANCE_INSUFFICIENT`, `RESOURCE_NOT_FOUND`).
- `GlobalExceptionFilter`: Menangkap semua error dan menghasilkan respons JSON seragam:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Pesan ramah pengguna",
      "requestId": "uuid"
    }
  }
  ```
- **Keamanan Galat**: Detail teknis, error database SQL, dan stack trace **HANYA** dicatat ke log server (tidak pernah dibocorkan ke klien).

### D. Logging Terkelola & Redaksi Data Sensitif (`common/logger`)

- `AppLogger`: Pino JSON logger dengan stempel waktu ISO.
- Redaksi otomatis (_censorship_) pada field-field sensitif: `password`, `token`, `cookie`, `authorization`, `nik`, `national_id`, `*_enc`.
- Propagasi `request_id` melalui `RequestLoggerMiddleware`.

### E. Jejak Audit & Rantai Hash (`common/audit`)

- `AuditService`: Menulis ke `audit.audit_logs` (append-only).
- Aksi yang didukung: `create`, `update`, `delete`, `login`, `logout`, `login_failed`, `export`, `view_sensitive`, `permission_change`, `dispose`.
- Masking otomatis pada data `before` dan `after` sebelum disimpan.
- **Integritas Rantai Hash**: Trigger database dan verifikator aplikasi menjamin integritas berurutan (`prev_hash` -> `row_hash`). Pendeteksian manipulasi manual, penghapusan baris, atau perusakan data.
- `AuditInterceptor`: Interceptor deklaratif menggunakan dekorator `@Audited()`.

### F. Otorisasi & Deny-by-Default (`common/auth`)

- `@Public()`: Menandai endpoint dapat diakses tanpa login secara eksplisit.
- `@RequirePermission(...permissions)`: Membatasi akses endpoint ke pengguna yang memiliki kode izin tertentu.
- `PermissionGuard`: Menegakkan prinsip **Deny-by-Default** — endpoint tanpa dekorator otorisasi otomatis ditolak (HTTP 403 `ENDPOINT_DENY_BY_DEFAULT`).
- Uji otomatis `route-security-scanner.spec.ts` memindai seluruh rute untuk memastikan tidak ada rute yang terlewat tanpa dekorator.

### G. Keamanan HTTP (`common/security`)

- **Helmet**: Content-Security-Policy (CSP) ketat, HSTS, frameguard (anti-clickjacking), nosniff.
- **CORS Whitelist**: Pemeriksaan origin berbasis whitelist konfigurasi.
- **CSRF Defense**: Verifikasi header Origin/Referer pada metode mutasi (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Rate Limiting**: `RateLimiterGuard` membatasi panggilan per IP untuk mencegah brute-force dan DoS.
- **Batas Payload**: Express body limit 1MB.

### H. Paginasi & Pengurutan Aman (`common/pagination`)

- `PaginationQuerySchema`: Validasi DTO paginasi (`page`, `limit` maks 100, `cursor`).
- `validateSortField`: Whitelisting kolom pengurutan untuk mencegah SQL Injection pada klausa `ORDER BY`.

### I. Transaksi & Unit of Work (`common/database`)

- `TransactionManager`: Menjalankan use case dalam satu transaksi PostgreSQL (`BEGIN` -> `COMMIT` / `ROLLBACK`).
- Menjamin beberapa repository dalam satu use case dapat berbagi client transaksi yang sama secara atomik.

---

## 2. Aturan Batas Modul (Modular Monolith)

Sesuai ESLint boundaries:

- Modul `common` **DILARANG** mengimpor kode apapun dari `modules/*`.
- Seluruh modul bisnis dapat mengimpor utilitas dari `common/*`.
