# Modul Perf (Kinerja)

## Tujuan

Mengelola siklus evaluasi kinerja berkala pegawai, penetapan sasaran kinerja individu (SKP/OKRs dengan bobot 1-100%), pelaporan progres dan bukti kinerja, aspek perilaku kerja, serta alur penilaian dan persetujuan bertingkat.

## Tabel Dimiliki (Skema: perf)

- `perf.cycles` - Periode/siklus evaluasi kinerja (tahunan/semester)
- `perf.goals` - Sasaran kinerja individu pegawai (CHECK weight > 0 AND weight <= 100)
- `perf.goal_progress` - Catatan capaian progres kerja berkala
- `perf.behavior_aspects` - Master aspek perilaku kerja
- `perf.appraisals` - Lembar penilaian kinerja pegawai per siklus
- `perf.appraisal_goal_scores` - Rincian nilai capaian sasaran kerja
- `perf.appraisal_behavior_scores` - Rincian nilai aspek perilaku
- `perf.appraisal_reviews` - Jejak alur telaah dan persetujuan penilaian

## Akses Data Drizzle

- Lokasi: `apps/api/src/modules/perf/infrastructure/schema.ts`
- Modul ini hanya mengakses tabel pada skema `perf`. Ketergantungan ke `hr.employees` dan `archive.documents` hanya melalui tipe ID string (UUID).

## Izin RBAC

- `perf.cycle.read` - Melihat daftar siklus kinerja
- `perf.cycle.manage` - Membuka/menutup periode siklus kinerja
- `perf.goal.read` - Melihat sasaran kerja
- `perf.goal.manage` - Membuat dan menetapkan sasaran kerja
- `perf.progress.read` - Melihat progres realisasi kerja
- `perf.progress.create` - Mengisi progres realisasi kerja
- `perf.appraisal.read` - Melihat lembar evaluasi kerja
- `perf.appraisal.create` - Mengisi evaluasi mandiri
- `perf.appraisal.evaluate` - Memberikan nilai kinerja bawahan
- `perf.appraisal.finalize` - Mengesahkan nilai akhir kinerja

## Event Domain

- `PerformanceCycleOpened` - Siklus evaluasi dibuka
- `PerformanceCycleClosed` - Siklus evaluasi ditutup
- `GoalSubmitted` - Sasaran kerja diajukan ke atasan
- `GoalApproved` - Sasaran kerja disetujui
- `AppraisalFinalized` - Penilaian selesai disahkan
