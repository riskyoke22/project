# 07. Arsitektur Kriptografi & Pengelolaan Kunci

Dokumen ini mendefinisikan standar kriptografi, format payload envelope enkripsi kolom, skema blind index, prosedur rotasi kunci, mitigasi kehilangan kunci, dan tata cara pembuatan kunci kriptografis pada **Sistem Terintegrasi**.

---

## 1. Algoritma & Standar Kriptografi

| Fungsi                      | Algoritma & Parameter                               | Tujuan Penggunaan                                                   |
| :-------------------------- | :-------------------------------------------------- | :------------------------------------------------------------------ |
| **Enkripsi Kolom**          | AES-256-GCM (Envelope Encryption)                   | Melindungi data sensitif di database (`nik_enc`, `phone_enc`, dll.) |
| **Pencarian Data Sensitif** | HMAC-SHA256 (Blind Index dengan Normalisasi)        | Pencarian eksak & deduplikasi tanpa mendekripsi kolom (`*_hash`)    |
| **Hash Kata Sandi**         | Argon2id (`v=19`, `m=19456` [19 MiB], `t=2`, `p=1`) | Autentikasi pengguna sesuai rekomendasi OWASP                       |
| **Token Sesi & Reset**      | CSPRNG 256-bit (`crypto.randomBytes(32)`) + SHA-256 | Token otentikasi; database hanya menyimpan hash token               |
| **Perbandingan Rahasia**    | Constant-Time (`crypto.timingSafeEqual`)            | Mencegah serangan _timing attack_                                   |
| **Derivasi Kunci**          | HKDF-SHA256 (RFC 5869)                              | Menurunkan KEK seragam 256-bit dari konfigurasi `APP_SECRET`        |

---

## 2. Format Payload Envelope Enkripsi Kolom

Setiap kolom dengan sufiks `_enc` (misal: `hr.employees.nik_enc`, `guest.visitors.id_number_enc`) disimpan dalam format string envelope:

```text
enc:v1:<base64_encoded_json_payload>
```

Struktur payload JSON setelah di-decode dari Base64:

```json
{
  "v": 1,
  "kid": "kek-v1",
  "dekIv": "q9Xm5... (12 bytes base64)",
  "dekTag": "p4Lv9... (16 bytes base64)",
  "edek": "k8Jn2... (32 bytes base64 ciphertext DEK)",
  "iv": "3mP9x... (12 bytes base64)",
  "tag": "8xKv1... (16 bytes base64 data auth tag)",
  "ct": "9nQz7... (data ciphertext base64)"
}
```

### Mengapa Envelope Encryption?

1. **Pemisahan Kunci (DEK vs KEK)**: Setiap rekaman data dienkripsi dengan _Data Encryption Key_ (DEK) acak 256-bit yang unik.
2. **Kinerja & Keamanan**: KEK (_Key Encryption Key_) hanya dipakai untuk membungkus DEK kecil (32 byte). KEK tidak pernah dipakai langsung untuk mengenkripsi gigabyte data, sehingga batas _ciphertext limits_ AES-GCM tidak pernah terlampaui.
3. **Dukungan Rotasi Tanpa Downtime**: Payload membawa metadata `kid` (_Key ID_). Ketika KEK diperbarui, data lama tetap dapat didekripsi menggunakan KEK versi lama yang tersimpan di keyring internal aplikasi.

---

## 3. Blind Index untuk Pencarian Data Sensitif

Data yang dienkripsi dengan AES-256-GCM menghasilkan ciphertext acak yang berbeda setiap kali dienkripsi (karena IV acak). Oleh karena itu, query SQL seperti `WHERE nik_enc = ?` tidak dapat dilakukan.

Sebagai solusinya, sistem menggunakan **Blind Index**:

```text
blind_index = HMAC-SHA256(BLIND_INDEX_SALT, normalize(nilai_mentah))
```

### Aturan Normalisasi Sebelum Hash

Sebelum dilakukan HMAC, input dinormalisasi:

1. `trim()`: Menghilangkan spasi awal/akhir.
2. `toLowerCase()`: Menyeragamkan huruf kecil.
3. Hapus pemisah/tanda baca: Mengeliminasi spasi, tanda minus (`-`), titik (`.`), garis miring (`/`), garis bawah (`_`), koma (`,`), dan backslash (`\`).

**Contoh:**

- Input: `" 3201-1234.5678-0001 "`
- Ternormalisasi: `"3201123456780001"`
- Kolom database: `nik_hash = "a7f3...64_karakter_hex..."`

Dengan aturan ini, pencarian pengguna yang memasukkan NIK dengan format strip atau spasi tetap menemukan rekaman yang benar secara eksak dan deterministik.

---

## 4. Prosedur Rotasi Kunci (Key Rotation)

Rotasi kunci KEK dilakukan secara bertahap dalam dua fase:

### Fase 1: Penambahan KEK Baru (Dual-Key Phase)

1. Buat KEK baru menggunakan skrip generator kunci.
2. Tetapkan KEK baru sebagai kunci aktif (`APP_SECRET` baru dengan `KEY_ID="kek-v2"`).
3. Daftarkan KEK lama ke keyring (`registerKek("kek-v1", oldSecret)`).
4. Pada fase ini:
   - Data baru akan dienkripsi dengan `kek-v2`.
   - Data lama tetap dapat dibaca menggunakan `kek-v1`.

### Fase 2: Re-Enkripsi Data Latar Belakang (Re-encryption Job)

1. Jalankan job background yang membaca rekaman dengan `payload.kid != currentKeyId`.
2. Panggil `CryptoService.rotate(payload, currentKeyId)`.
3. Update kolom `*_enc` dengan payload baru.
4. Setelah seluruh database ter-update ke `kek-v2`, KEK lama (`kek-v1`) dapat diarsipkan dan dicabut dari konfigurasi aktif.

---

## 5. Mitigasi Jika Kunci Hilang (Disaster Recovery)

> [!CAUTION]
> **Kehilangan KEK / APP_SECRET bersifat permanen dan tidak dapat dipulihkan.**
> Kriptografi AES-256-GCM tidak memiliki pintu belakang (_backdoor_). Jika KEK hilang:
>
> - Seluruh kolom `*_enc` (NIK, nomor telepon, data tamu, rahasia MFA) **tidak akan pernah bisa didekripsi lagi**.
> - Data plain dan data relasional non-enkripsi lainnya tetap utuh.

### Prosedur Mitigasi & Cadangan Kunci:

1. **Pemisahan Cadangan Kunci**: Kunci enkripsi (`APP_SECRET`, `BLIND_INDEX_SALT`, `JWT_*_SECRET`) **DILARANG KERAS** disimpan di dalam repositori Git atau backup database biasa.
2. **Kunci Dicadangkan Terpisah**: Kunci produksi harus disimpan di brankas terenkripsi (misal: KeePass / Vault / SOPS dengan kunci terdistribusi pengurus organisasi).
3. **Prinsip _Split-Secret_ (Shamir's Secret Sharing / 2-Person Integrity)**: Untuk lingkungan produksi berisiko tinggi, kunci master dipecah ke dua pejabat berwenang yang berbeda.

---

## 6. Tata Cara Membuat Kunci Baru

Sistem menyediakan skrip khusus untuk menghasilkan seluruh kunci acak dengan entropi tinggi menggunakan CSPRNG Node.js:

```bash
# Jalankan dari root repositori:
node scripts/generate-keys.mjs
```

Skrip ini secara otomatis:

1. Menghasilkan token acak heksadesimal 256-bit (32 bytes) menggunakan `crypto.randomBytes()`.
2. Menghasilkan kunci untuk: `APP_SECRET`, `DEK_ENCRYPTION_KEY`, `BLIND_INDEX_SALT`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, kata sandi database, dan MinIO.
3. Menulis konfigurasi aman ke `.env.local` lokal yang sudah terdaftar di `.gitignore`.
