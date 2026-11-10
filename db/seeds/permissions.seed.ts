import { PERMISSIONS } from '@sistem-terintegrasi/shared';

export interface PermissionSeed {
  code: string;
  module: string;
  description: string;
}

export const PERMISSION_SEEDS: PermissionSeed[] = [
  // Modul IAM / Core
  {
    code: PERMISSIONS.IAM_USER_READ,
    module: 'iam',
    description: 'Melihat profil dan daftar pengguna',
  },
  { code: PERMISSIONS.IAM_USER_CREATE, module: 'iam', description: 'Membuat akun pengguna baru' },
  {
    code: PERMISSIONS.IAM_USER_UPDATE,
    module: 'iam',
    description: 'Memperbarui data akun pengguna',
  },
  {
    code: PERMISSIONS.IAM_USER_DELETE,
    module: 'iam',
    description: 'Menonaktifkan / menghapus akun pengguna',
  },
  {
    code: PERMISSIONS.IAM_ROLE_READ,
    module: 'iam',
    description: 'Melihat daftar peran dan hak akses',
  },
  {
    code: PERMISSIONS.IAM_ROLE_MANAGE,
    module: 'iam',
    description: 'Mengelola peran dan penugasan hak akses',
  },
  {
    code: PERMISSIONS.IAM_ORG_UNIT_READ,
    module: 'iam',
    description: 'Melihat struktur unit organisasi',
  },
  {
    code: PERMISSIONS.IAM_ORG_UNIT_MANAGE,
    module: 'iam',
    description: 'Mengelola hierarki unit organisasi',
  },
  { code: PERMISSIONS.IAM_SESSION_READ, module: 'iam', description: 'Melihat sesi login aktif' },
  {
    code: PERMISSIONS.IAM_SESSION_REVOKE,
    module: 'iam',
    description: 'Mencabut sesi login pengguna',
  },

  // Modul Kepegawaian (HR)
  { code: PERMISSIONS.HR_EMPLOYEE_READ, module: 'hr', description: 'Melihat data biodata pegawai' },
  { code: PERMISSIONS.HR_EMPLOYEE_CREATE, module: 'hr', description: 'Menambah data pegawai baru' },
  {
    code: PERMISSIONS.HR_EMPLOYEE_UPDATE,
    module: 'hr',
    description: 'Memperbarui data kepegawaian',
  },
  {
    code: PERMISSIONS.HR_EMPLOYEE_DELETE,
    module: 'hr',
    description: 'Menghapus / menonaktifkan data pegawai',
  },
  {
    code: PERMISSIONS.HR_ASSIGNMENT_READ,
    module: 'hr',
    description: 'Melihat riwayat penempatan dan jabatan',
  },
  {
    code: PERMISSIONS.HR_ASSIGNMENT_MANAGE,
    module: 'hr',
    description: 'Mengelola mutasi dan penempatan jabatan',
  },
  { code: PERMISSIONS.HR_FAMILY_READ, module: 'hr', description: 'Melihat data keluarga pegawai' },
  {
    code: PERMISSIONS.HR_FAMILY_MANAGE,
    module: 'hr',
    description: 'Mengelola data susunan keluarga pegawai',
  },
  {
    code: PERMISSIONS.HR_EDUCATION_READ,
    module: 'hr',
    description: 'Melihat riwayat pendidikan pegawai',
  },
  {
    code: PERMISSIONS.HR_EDUCATION_MANAGE,
    module: 'hr',
    description: 'Mengelola riwayat pendidikan pegawai',
  },
  {
    code: PERMISSIONS.HR_LEAVE_READ,
    module: 'hr',
    description: 'Melihat permohonan dan saldo cuti',
  },
  { code: PERMISSIONS.HR_LEAVE_APPLY, module: 'hr', description: 'Mengajukan permohonan cuti' },
  {
    code: PERMISSIONS.HR_LEAVE_APPROVE,
    module: 'hr',
    description: 'Menyetujui atau menolak permohonan cuti',
  },
  {
    code: PERMISSIONS.HR_LEAVE_BALANCE_MANAGE,
    module: 'hr',
    description: 'Mengelola saldo dan hak cuti tahunan',
  },
  {
    code: PERMISSIONS.HR_REFERENCE_MANAGE,
    module: 'hr',
    description: 'Mengelola master golongan, jabatan, dan status kerja',
  },

  // Modul Kinerja (Perf)
  {
    code: PERMISSIONS.PERF_CYCLE_READ,
    module: 'perf',
    description: 'Melihat periode / siklus penilaian kinerja',
  },
  {
    code: PERMISSIONS.PERF_CYCLE_MANAGE,
    module: 'perf',
    description: 'Membuka dan menutup siklus penilaian kinerja',
  },
  {
    code: PERMISSIONS.PERF_GOAL_READ,
    module: 'perf',
    description: 'Melihat sasaran kinerja individu / SKP',
  },
  {
    code: PERMISSIONS.PERF_GOAL_MANAGE,
    module: 'perf',
    description: 'Membuat dan menetapkan sasaran kinerja',
  },
  {
    code: PERMISSIONS.PERF_PROGRESS_READ,
    module: 'perf',
    description: 'Melihat progres realisasi sasaran kinerja',
  },
  {
    code: PERMISSIONS.PERF_PROGRESS_CREATE,
    module: 'perf',
    description: 'Mengisi capaian progres dan bukti kinerja',
  },
  {
    code: PERMISSIONS.PERF_APPRAISAL_READ,
    module: 'perf',
    description: 'Melihat lembar evaluasi kinerja',
  },
  {
    code: PERMISSIONS.PERF_APPRAISAL_CREATE,
    module: 'perf',
    description: 'Mengisi evaluasi diri capaian kinerja',
  },
  {
    code: PERMISSIONS.PERF_APPRAISAL_EVALUATE,
    module: 'perf',
    description: 'Memberikan penilaian kinerja bawahan',
  },
  {
    code: PERMISSIONS.PERF_APPRAISAL_FINALIZE,
    module: 'perf',
    description: 'Mengesahkan nilai akhir kinerja',
  },

  // Modul Tata Kelola Arsip (Archive)
  {
    code: PERMISSIONS.ARCHIVE_DOCUMENT_READ,
    module: 'archive',
    description: 'Mencari dan membaca naskah dinas / arsip',
  },
  {
    code: PERMISSIONS.ARCHIVE_DOCUMENT_CREATE,
    module: 'archive',
    description: 'Mendaftarkan naskah dinas baru',
  },
  {
    code: PERMISSIONS.ARCHIVE_DOCUMENT_UPDATE,
    module: 'archive',
    description: 'Mengubah metadata naskah dinas',
  },
  {
    code: PERMISSIONS.ARCHIVE_DOCUMENT_MANAGE,
    module: 'archive',
    description: 'Mengelola dokumen dan hak akses arsip',
  },
  {
    code: PERMISSIONS.ARCHIVE_DOCUMENT_DESTROY,
    module: 'archive',
    description: 'Memusnahkan arsip sesuai retensi',
  },
  {
    code: PERMISSIONS.ARCHIVE_VERSION_READ,
    module: 'archive',
    description: 'Melihat riwayat versi berkas arsip',
  },
  {
    code: PERMISSIONS.ARCHIVE_VERSION_CREATE,
    module: 'archive',
    description: 'Mengunggah revisi versi dokumen baru',
  },
  {
    code: PERMISSIONS.ARCHIVE_DISPOSITION_READ,
    module: 'archive',
    description: 'Melihat disposisi naskah dinas',
  },
  {
    code: PERMISSIONS.ARCHIVE_DISPOSITION_CREATE,
    module: 'archive',
    description: 'Membuat disposisi instruksi pimpinan',
  },
  {
    code: PERMISSIONS.ARCHIVE_DISPOSITION_ACTION,
    module: 'archive',
    description: 'Menindaklanjuti instruksi disposisi',
  },
  {
    code: PERMISSIONS.ARCHIVE_CATEGORY_MANAGE,
    module: 'archive',
    description: 'Mengelola klasifikasi dan jadwal retensi arsip',
  },
  {
    code: PERMISSIONS.ARCHIVE_LOCATION_MANAGE,
    module: 'archive',
    description: 'Mengelola master lokasi simpan fisik',
  },
  {
    code: PERMISSIONS.ARCHIVE_DISPOSAL_MANAGE,
    module: 'archive',
    description: 'Membuat berita acara pemusnahan / penyerahan arsip',
  },

  // Modul Buku Tamu (Guest)
  {
    code: PERMISSIONS.GUEST_VISITOR_READ,
    module: 'guest',
    description: 'Melihat riwayat pengunjung kantor',
  },
  {
    code: PERMISSIONS.GUEST_VISITOR_MANAGE,
    module: 'guest',
    description: 'Mengelola data dan status blokir pengunjung',
  },
  {
    code: PERMISSIONS.GUEST_APPOINTMENT_READ,
    module: 'guest',
    description: 'Melihat jadwal janji temu tamu',
  },
  {
    code: PERMISSIONS.GUEST_APPOINTMENT_CREATE,
    module: 'guest',
    description: 'Mengajukan pra-registrasi janji temu',
  },
  {
    code: PERMISSIONS.GUEST_APPOINTMENT_APPROVE,
    module: 'guest',
    description: 'Menyetujui permohonan kunjungan tamu',
  },
  {
    code: PERMISSIONS.GUEST_VISIT_READ,
    module: 'guest',
    description: 'Melihat buku tamu dan log kunjungan fisik',
  },
  {
    code: PERMISSIONS.GUEST_VISIT_CREATE,
    module: 'guest',
    description: 'Melakukan check-in tamu dan cetak lencana',
  },
  {
    code: PERMISSIONS.GUEST_VISIT_CHECKOUT,
    module: 'guest',
    description: 'Melakukan check-out tamu',
  },

  // Modul Berkas (Files)
  {
    code: PERMISSIONS.FILES_UPLOAD,
    module: 'files',
    description: 'Mengunggah berkas ke penyimpanan aman',
  },
  { code: PERMISSIONS.FILES_DOWNLOAD, module: 'files', description: 'Mengunduh berkas lampiran' },
  { code: PERMISSIONS.FILES_DELETE, module: 'files', description: 'Menghapus berkas lampiran' },

  // Modul Audit (Audit)
  {
    code: PERMISSIONS.AUDIT_LOG_READ,
    module: 'audit',
    description: 'Melihat log jejak audit sistem',
  },
  {
    code: PERMISSIONS.AUDIT_LOG_EXPORT,
    module: 'audit',
    description: 'Mengekspor laporan jejak audit untuk audit kepatuhan',
  },
];
