# Modul HR (Kepegawaian)

## Tujuan

Mengelola data master kepegawaian, biodata pegawai (NIK & nomor telepon terenkripsi `_enc` dengan blind index `_hash`), riwayat penempatan dan jabatan (dengan exclusion constraint penempatan utama non-overlapping), susunan keluarga, riwayat pendidikan formal, dan manajemen cuti/izin.

## Tabel Dimiliki (Skema: hr)

- `hr.employment_statuses` - Master status kepegawaian (tetap, kontrak, percobaan)
- `hr.grades` - Master golongan / kepangkatan pegawai
- `hr.positions` - Master jabatan organisasi
- `hr.employees` - Data induk pegawai (NIK terenkripsi AES-256-GCM + blind index HMAC-SHA256)
- `hr.employee_assignments` - Riwayat jabatan dan penempatan (EXCLUDE USING gist `daterange`)
- `hr.employee_families` - Data keluarga pegawai
- `hr.employee_educations` - Riwayat pendidikan formal pegawai
- `hr.leave_types` - Jenis-jenis cuti dan kuota tahunan
- `hr.leave_balances` - Kuota, perpanjangan, dan sisa cuti tahunan
- `hr.leave_requests` - Pengajuan, verifikasi, dan persetujuan cuti

## Akses Data Drizzle

- Lokasi: `apps/api/src/modules/hr/infrastructure/schema.ts`
- Modul ini hanya mengakses tabel pada skema `hr`. Ketergantungan ke `core` (seperti `user_id`, `org_unit_id`, `file_id`) hanya disimpan dalam bentuk tipe ID string (UUID).

## Izin RBAC

- `hr.employee.read` - Melihat data pegawai
- `hr.employee.create` - Menambah pegawai baru
- `hr.employee.update` - Memperbarui profil pegawai
- `hr.employee.delete` - Menghapus data pegawai
- `hr.assignment.read` - Melihat riwayat penempatan jabatan
- `hr.assignment.manage` - Mengelola penempatan jabatan
- `hr.family.read` - Melihat data keluarga pegawai
- `hr.family.manage` - Mengelola data keluarga pegawai
- `hr.education.read` - Melihat riwayat pendidikan
- `hr.education.manage` - Mengelola data pendidikan
- `hr.leave.read` - Melihat pengajuan & saldo cuti
- `hr.leave.apply` - Mengajukan permohonan cuti
- `hr.leave.approve` - Menyetujui atau menolak cuti
- `hr.leave_balance.manage` - Mengelola saldo cuti tahunan
- `hr.reference.manage` - Mengelola master status kerja, golongan, dan jabatan

## Event Domain

- `EmployeeCreated` - Pegawai baru terdaftar
- `EmployeeUpdated` - Data pegawai diperbarui
- `PositionAssigned` - Penempatan jabatan ditetapkan
- `LeaveRequested` - Permohonan cuti baru diajukan
- `LeaveApproved` - Cuti disetujui atasan
- `LeaveRejected` - Cuti ditolak
