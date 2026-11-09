# Modul Archive (Arsip & Dokumen)

## Tujuan

Mengelola tata naskah dinas dan arsip organisasi sesuai kaidah kearsipan: klasifikasi pola berkas, pencarian teks penuh (`tsvector`), riwayat versi berkas dokumen (`archive.document_versions` dengan deferred FK), kendali akses per dokumen (`document_acl`), alur disposisi berantai, jadwal retensi aktif/inaktif, hingga berita acara pemusnahan resmi (`disposal_records`).

## Tabel Dimiliki (Skema: archive)

- `archive.categories` - Klasifikasi arsip dan jadwal retensi (JRA)
- `archive.physical_locations` - Lokasi fisik simpan arsip (gedung, ruang, rak, boks)
- `archive.documents` - Naskah dinas, surat masuk/keluar, SK, memo (dengan `search_vector`)
- `archive.document_versions` - Riwayat versi berkas fisik dokumen
- `archive.document_acl` - Hak akses khusus per dokumen (user, role, org_unit)
- `archive.document_dispositions` - Lembar disposisi instruksi tindak lanjut
- `archive.document_links` - Relasi antar dokumen (reply_to, attachment_of, dll.)
- `archive.document_tags` - Label/tag pencarian dokumen
- `archive.disposal_records` - Berita acara pemusnahan atau penyerahan arsip statis
- `archive.disposal_items` - Daftar dokumen yang dimusnahkan/diserahkan

## Akses Data Drizzle

- Lokasi: `apps/api/src/modules/archive/infrastructure/schema.ts`
- Modul ini hanya mengakses tabel pada skema `archive`. Ketergantungan ke modul lain (`core.org_units`, `core.files`, `core.users`) hanya melalui tipe ID string (UUID).

## Izin RBAC

- `archive.document.read` - Membaca dan mencari arsip
- `archive.document.create` - Mendaftarkan naskah dinas baru
- `archive.document.update` - Memperbarui metadata naskah dinas
- `archive.document.manage` - Mengelola berkas dan izin akses dokumen
- `archive.document.destroy` - Memusnahkan arsip sesuai retensi
- `archive.version.read` - Melihat versi berkas arsip
- `archive.version.create` - Mengunggah versi dokumen baru
- `archive.disposition.read` - Melihat disposisi surat
- `archive.disposition.create` - Membuat disposisi pimpinan
- `archive.disposition.action` - Menindaklanjuti disposisi
- `archive.category.manage` - Mengelola klasifikasi dan JRA
- `archive.location.manage` - Mengelola lokasi simpan fisik
- `archive.disposal.manage` - Mengelola berita acara pemusnahan

## Event Domain

- `DocumentRegistered` - Naskah dinas baru dicatat
- `DocumentVersionAdded` - Versi revisi dokumen diunggah
- `DispositionSent` - Disposisi diteruskan ke penerima
- `DocumentRetentionExpired` - Dokumen memasuki masa akhir retensi
- `DocumentDestroyed` - Arsip resmi dimusnahkan dengan berita acara
