# Modul Guest (Buku Tamu)

## Tujuan

Mengelola kunjungan tamu organisasi: pra-registrasi daring oleh pengunjung, verifikasi identitas di meja resepsionis (nomor identitas, telepon, dan email terenkripsi `_enc` dengan blind index `_hash`), persetujuan pemrosesan data pribadi (kepatuhan UU PDP), pencatatan kehadiran fisik (check-in), pendamping, dan kepulangan (check-out).

## Tabel Dimiliki (Skema: guest)

- `guest.visitors` - Master pengunjung (identitas terenkripsi AES-256-GCM + blind index HMAC-SHA256)
- `guest.appointments` - Pra-registrasi dan jadwal janji temu dengan token QR hash
- `guest.visits` - Log kehadiran fisik kunjungan tamu, nomor lencana, dan consent waktu
- `guest.visit_companions` - Data pendamping rombongan pengunjung

## Akses Data Drizzle

- Lokasi: `apps/api/src/modules/guest/infrastructure/schema.ts`
- Modul ini hanya mengakses tabel pada skema `guest`. Ketergantungan ke `core.files`, `core.org_units`, dan `hr.employees` hanya berupa tipe ID string (UUID).

## Izin RBAC

- `guest.visitor.read` - Melihat daftar dan histori pengunjung
- `guest.visitor.manage` - Mengelola data dan status blokir pengunjung
- `guest.appointment.read` - Melihat janji temu kunjungan
- `guest.appointment.create` - Mengajukan pra-registrasi janji temu
- `guest.appointment.approve` - Menyetujui kunjungan tamu
- `guest.visit.read` - Melihat buku tamu fisik
- `guest.visit.create` - Melakukan check-in tamu
- `guest.visit.checkout` - Mencatat check-out kepulangan tamu

## Event Domain

- `VisitorRegistered` - Data pengunjung baru terdaftar
- `AppointmentBooked` - Janji temu tamu berhasil diajukan
- `GuestCheckedIn` - Tamu tiba dan check-in fisik
- `GuestCheckedOut` - Tamu menyelesaikan kunjungan dan check-out
- `GuestConsentGiven` - Persetujuan pemrosesan data pribadi dicatat
