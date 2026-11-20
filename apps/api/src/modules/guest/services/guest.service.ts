import { Injectable, Optional } from '@nestjs/common';
import { PoolClient } from 'pg';
import { TransactionManager } from '../../../common/database/transaction';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { ConflictError, DatabaseError, ValidationError } from '../../../common/errors/app-error';
import { AppLogger } from '../../../common/logger/logger.service';
import { CreatePublicVisitDto } from '../dto/create-public-visit.dto';

/**
 * GuestService — logika bisnis untuk modul Buku Tamu.
 *
 * createPublicVisit: membuat record visitor dan visit dalam satu transaksi atomik.
 * Data sensitif (telepon, email) dienkripsi menggunakan CryptoService ke format Buffer (bytea)
 * sebelum disimpan ke database PostgreSQL.
 *
 * Endpoint publik hanya untuk membuat data kunjungan.
 * Pembacaan data kunjungan memerlukan autentikasi dan otorisasi.
 */
@Injectable()
export class GuestService {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly cryptoService: CryptoService,
    @Optional() private readonly logger?: AppLogger,
  ) {}

  /**
   * Mengenkripsi string plaintext menjadi Buffer untuk kolom PostgreSQL bertipe `bytea`.
   */
  public encryptToBytea(plaintext?: string | null): Buffer | null {
    if (!plaintext || plaintext.trim() === '') {
      return null;
    }
    const encryptedString = this.cryptoService.encrypt(plaintext.trim());
    return Buffer.from(encryptedString, 'utf-8');
  }

  /**
   * Mendekripsi Buffer dari kolom PostgreSQL bertipe `bytea` kembali ke string plaintext.
   */
  public decryptBytea(encryptedBuffer?: Buffer | Uint8Array | string | null): string | null {
    if (!encryptedBuffer) {
      return null;
    }
    const ciphertext = Buffer.isBuffer(encryptedBuffer)
      ? encryptedBuffer.toString('utf-8')
      : typeof encryptedBuffer === 'string'
        ? encryptedBuffer
        : Buffer.from(encryptedBuffer).toString('utf-8');
    return this.cryptoService.decrypt(ciphertext);
  }

  /**
   * Memverifikasi aturan bisnis sebelum data disimpan.
   */
  validateBusinessRules(dto: CreatePublicVisitDto): void {
    if (dto.consentGiven === false) {
      throw new ValidationError(
        'Persetujuan pemrosesan data pribadi wajib disetujui.',
        'CONSENT_REQUIRED',
      );
    }

    // Cek apakah nama host bukan hanya angka atau karakter tidak masuk akal
    if (/^\d+$/.test(dto.hostEmployeeName)) {
      throw new ValidationError('Nama yang dikunjungi tidak valid.', 'INVALID_HOST_NAME');
    }
  }

  /**
   * Membuat kunjungan publik (walk-in) baru secara atomik.
   * - Menolak duplikasi cepat (pengiriman berulang dalam kurun waktu 1 menit)
   * - Mengenkripsi kontak (telepon, email) menggunakan CryptoService sebelum insert
   * - Mencatat waktu persetujuan (consent_at)
   * - Tidak mencatat PII pengunjung ke server log
   */
  async createPublicVisit(dto: CreatePublicVisitDto): Promise<{ id: string; checkInAt: string }> {
    this.logger?.log(
      '[GuestService] Memproses pencatatan kunjungan publik walk-in',
      'GuestService',
    );

    return this.transactionManager.runInTransaction(async (client: PoolClient) => {
      // 1. Cek pencegahan duplikasi pengiriman berulang (dalam 1 menit terakhir untuk nama & host yang sama)
      const duplicateCheck = await client.query(
        `SELECT v.id FROM guest.visits v
         JOIN guest.visitors vis ON v.visitor_id = vis.id
         WHERE vis.full_name = $1
           AND v.host_employee_name = $2
           AND v.purpose = $3
           AND v.check_in_at >= now() - interval '1 minute'
         LIMIT 1`,
        [dto.fullName, dto.hostEmployeeName, dto.purpose],
      );

      if (duplicateCheck.rows.length > 0) {
        throw new ConflictError(
          'Kunjungan serupa baru saja dicatat. Mohon tunggu beberapa saat sebelum mengirim kembali.',
          'DUPLICATE_VISIT_DETECTED',
        );
      }

      // 2. Enkripsi nomor telepon dan email ke format Buffer untuk kolom bytea
      const phoneEnc = this.encryptToBytea(dto.phone);
      const emailEnc = this.encryptToBytea(dto.email);

      // 3. Buat record visitor
      const visitorResult = await client.query(
        `INSERT INTO guest.visitors (full_name, organization, phone_enc, email_enc)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [dto.fullName, dto.organization || null, phoneEnc, emailEnc],
      );

      const visitorRow = visitorResult.rows.at(0);
      if (!visitorRow) {
        throw new DatabaseError('Gagal membuat record pengunjung.', 'VISITOR_INSERT_FAILED');
      }

      const visitorId = visitorRow.id;

      // 4. Buat record visit dengan consent_at
      const visitResult = await client.query(
        `INSERT INTO guest.visits (
          visitor_id, purpose, party_size,
          host_employee_name, host_org_unit_name,
          check_in_at, consent_at, status
        ) VALUES ($1, $2, $3, $4, $5, now(), now(), 'checked_in')
        RETURNING id, check_in_at`,
        [visitorId, dto.purpose, dto.partySize, dto.hostEmployeeName, dto.hostOrgUnitName || null],
      );

      const visitRow = visitResult.rows.at(0);
      if (!visitRow) {
        throw new DatabaseError('Gagal membuat record kunjungan.', 'VISIT_INSERT_FAILED');
      }

      this.logger?.log(
        `[GuestService] Kunjungan berhasil dibuat: id=${visitRow.id}`,
        'GuestService',
      );

      const checkInAt =
        visitRow.check_in_at instanceof Date
          ? visitRow.check_in_at.toISOString()
          : new Date(visitRow.check_in_at).toISOString();

      return {
        id: visitRow.id,
        checkInAt,
      };
    });
  }
}
