# Modul Files (Pengelolaan Berkas)

## Tujuan

Menyediakan antarmuka penyimpanan berkas terpusat yang aman: validasi ukuran & tipe MIME, pengunggahan ke object storage (MinIO/S3), orkestrasi pemindaian virus ClamAV sebelum file dapat diunduh, deteksi duplikasi via hash SHA-256, dan pembuatan presigned download URL berumur pendek.

## Tabel Dimiliki (Skema: core)

- `core.files` - Metadata berkas, status pemindaian virus (`pending`, `clean`, `infected`, `failed`), dan lokasi objek penyimpanan

## Akses Data Drizzle

- Lokasi: `apps/api/src/modules/files/infrastructure/schema.ts`
- Modul ini hanya mengakses tabel `core.files`.

## Izin RBAC

- `files.file.upload` - Mengunggah berkas baru
- `files.file.download` - Meminta tautan unduh berkas
- `files.file.delete` - Menghapus berkas lampiran

## Event Domain

- `FileUploaded` - Berkas selesai diunggah dan siap dipindai
- `FileScanClean` - Berkas diverifikasi bersih dari malware
- `FileScanInfected` - Berkas terdeteksi mengandung ancaman dan diisolasi
- `FileDeleted` - Berkas dihapus dari penyimpanan
