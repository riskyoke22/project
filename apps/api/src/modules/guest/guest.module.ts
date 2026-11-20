import { Module } from '@nestjs/common';
import { GuestController } from './controllers/guest.controller';
import { GuestService } from './services/guest.service';
import { CryptoModule } from '../../common/crypto/crypto.module';

/**
 * GuestModule — modul Buku Tamu.
 *
 * Mengelola pencatatan kunjungan publik (walk-in) dan manajemen data kunjungan.
 *
 * Endpoint publik:
 * - POST /guest/visits — Membuat kunjungan baru (tanpa autentikasi)
 *
 * Endpoint terproteksi (belum diimplementasikan, memerlukan IAM):
 * - GET /guest/visits — Melihat daftar kunjungan (admin)
 * - PATCH /guest/visits/:id/checkout — Check-out kunjungan (admin)
 */
@Module({
  imports: [CryptoModule],
  controllers: [GuestController],
  providers: [GuestService],
  exports: [GuestService],
})
export class GuestModule {}
