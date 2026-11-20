-- =============================================================================
-- Migrasi 0009: Kolom nama host untuk kunjungan walk-in Buku Tamu
--
-- Tujuan: Memungkinkan pencatatan kunjungan publik (walk-in) tanpa mengetahui
-- UUID pegawai host. Kolom ini bersifat opsional dan hanya diisi ketika
-- host_employee_id tidak tersedia (mis. dari formulir publik Buku Tamu).
--
-- Dampak: ADD COLUMN nullable — tidak menghapus atau mengubah data existing.
-- =============================================================================

ALTER TABLE guest.visits
  ADD COLUMN IF NOT EXISTS host_employee_name text,
  ADD COLUMN IF NOT EXISTS host_org_unit_name text;

COMMENT ON COLUMN guest.visits.host_employee_name IS
  'Nama pegawai yang dikunjungi (untuk walk-in tanpa UUID pegawai).';
COMMENT ON COLUMN guest.visits.host_org_unit_name IS
  'Nama bagian/unit yang dikunjungi (untuk walk-in tanpa UUID unit).';
