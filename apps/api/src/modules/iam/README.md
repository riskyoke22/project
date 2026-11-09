# Modul IAM (Identity & Access Management)

## Tujuan

Mengelola siklus hidup identitas pengguna, autentikasi aman (Argon2id, rotasi sesi, MFA TOTP), otorisasi berbasis peran (RBAC deny-by-default) dengan cakupan unit organisasi (`ltree`), dan struktur organisasi.

## Tabel Dimiliki (Skema: core)

- `core.org_units` - Pohon unit organisasi (hierarki dengan `ltree`)
- `core.users` - Akun pengguna organisasi
- `core.roles` - Peran pengguna
- `core.permissions` - Daftar izin sistem
- `core.role_permissions` - Pemetaan peran ke izin
- `core.user_roles` - Penugasan peran ke pengguna dengan cakupan unit
- `core.auth_sessions` - Sesi aktif dan pelacakan family refresh token
- `core.mfa_factors` - Faktor autentikasi kedua (TOTP)
- `core.number_sequences` - Penomoran berurutan per lingkup & tahun
- `core.notifications` - Notifikasi dalam sistem

## Akses Data Drizzle

- Lokasi: `apps/api/src/modules/iam/infrastructure/schema.ts`
- Modul ini hanya mengakses tabel pada skema `core`.

## Izin RBAC

- `iam.user.read` - Melihat data pengguna
- `iam.user.create` - Menambah pengguna baru
- `iam.user.update` - Memperbarui data pengguna
- `iam.user.delete` - Menonaktifkan pengguna
- `iam.role.read` - Melihat peran dan hak akses
- `iam.role.manage` - Mengelola peran dan izin
- `iam.org_unit.read` - Melihat struktur unit organisasi
- `iam.org_unit.manage` - Mengelola unit organisasi
- `iam.session.read` - Melihat sesi aktif
- `iam.session.revoke` - Memutuskan sesi login

## Event Domain

- `UserCreated` - Akun pengguna baru didaftarkan
- `UserDeactivated` - Akun dinonaktifkan
- `RoleAssigned` - Peran diberikan ke pengguna
- `PasswordResetRequested` - Permintaan reset kata sandi
- `SessionRevoked` - Sesi diputus
