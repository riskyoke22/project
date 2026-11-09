# Modul Audit (Jejak Audit & Integritas)

## Tujuan

Menyimpan jejak audit sistem yang append-only dan tamper-evident untuk kepatuhan regulasi & keamanan. Menggunakan rantai hash kriptografis SHA-256 (`row_hash = SHA256(prev_hash || log_data)`), advisory transaction lock, dan trigger pencegahan modifikasi/penghapusan (`forbid_change`). Seluruh data sensitif wajib dimasking sebelum dicatat ke kolom `before_data`/`after_data`.

## Tabel Dimiliki (Skema: audit)

- `audit.audit_logs` - Catatan peristiwa penting sistem (append-only, tamper-evident)

## Akses Data Drizzle

- Lokasi: `apps/api/src/modules/audit/infrastructure/schema.ts`
- Modul ini hanya mengakses tabel `audit.audit_logs`.

## Izin RBAC

- `audit.log.read` - Melihat rekaman jejak audit
- `audit.log.export` - Mengekspor laporan jejak audit untuk audit kepatuhan

## Hak Akses Database (Least Privilege)

- Role `app_rw`: Hanya memiliki izin `SELECT` dan `INSERT`. Izin `UPDATE`, `DELETE`, dan `TRUNCATE` dicabut secara eksplisit (`REVOKE`).
- Role `app_ro`: Hanya memiliki izin `SELECT`.

## Event Domain

- `AuditEventLogged` - Entri audit baru berhasil dicatat
- `AuditHashChainVerified` - Integritas rantai hash berhasil diverifikasi aman
- `AuditTamperingDetected` - Ketidaksesuaian hash terdeteksi (peringatan integritas)
