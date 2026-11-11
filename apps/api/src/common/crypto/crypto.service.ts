import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { AppConfigService } from '../config/env.config';
import { EncryptedPayload, EncryptOptions, Argon2Options } from './crypto.types';

const ENVELOPE_PREFIX = 'enc:v1:';
const AES_GCM_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // Rekomendasi NIST SP 800-38D untuk GCM
const KEY_LENGTH_BYTES = 32; // 256 bits

@Injectable()
export class CryptoService {
  private readonly defaultKeyId: string;
  private readonly kekKeyring: Map<string, Buffer>;
  private readonly blindIndexSalt: string;
  private readonly argon2Defaults: Required<Argon2Options>;

  constructor(private readonly config: AppConfigService) {
    this.defaultKeyId = this.config.get('KEY_ID');
    this.blindIndexSalt = this.config.get('BLIND_INDEX_SALT');
    this.kekKeyring = new Map<string, Buffer>();

    // Turunkan KEK aktif saat ini dari APP_SECRET menggunakan HKDF
    const appSecret = this.config.get('APP_SECRET');
    this.registerKek(this.defaultKeyId, appSecret);

    this.argon2Defaults = {
      memoryCost: this.config.get('ARGON2_MEMORY_COST'),
      timeCost: this.config.get('ARGON2_TIME_COST'),
      parallelism: this.config.get('ARGON2_PARALLELISM'),
      outputLen: 32,
    };
  }

  /**
   * Mendaftarkan kunci KEK (Key Encryption Key) ke keyring internal.
   * Dipakai untuk mendukung pembacaan data lama saat proses rotasi kunci KEK berjalan.
   */
  public registerKek(keyId: string, rawSecret: string): void {
    // Gunakan HKDF-SHA256 untuk memastikan entropi dan panjang kunci 256-bit seragam
    const derivedKey = crypto.hkdfSync(
      'sha256',
      Buffer.from(rawSecret, 'utf-8'),
      Buffer.from('sistem-terintegrasi-kek-salt', 'utf-8'),
      Buffer.from(`kek-derivation:${keyId}`, 'utf-8'),
      KEY_LENGTH_BYTES,
    );
    this.kekKeyring.set(keyId, Buffer.from(derivedKey));
  }

  /**
   * Mengambil KEK yang tersimpan di keyring berdasarkan keyId.
   */
  private getKek(keyId: string): Buffer {
    const key = this.kekKeyring.get(keyId);
    if (!key) {
      throw new Error(
        `[CryptoError] KEK dengan key_id '${keyId}' tidak ditemukan di keyring. Data tidak dapat didekripsi.`,
      );
    }
    return key;
  }

  // ===========================================================================
  // 1. ENKRIPSI KOLOM (ENVELOPE AES-256-GCM)
  // ===========================================================================

  /**
   * Mengenkripsi data sensitif menggunakan pola envelope encryption:
   * 1. Hasilkan DEK acak 256-bit khusus untuk record ini.
   * 2. Enkripsi data sensitif dengan DEK (AES-256-GCM).
   * 3. Bungkus (wrap) DEK dengan KEK aktif (AES-256-GCM).
   * 4. Gabungkan seluruh parameter ke dalam format string aman untuk kolom database (*_enc).
   */
  public encrypt(plaintext: string | Buffer, options?: EncryptOptions): string {
    const keyId = options?.keyId || this.defaultKeyId;
    const kek = this.getKek(keyId);

    // 1. Buat DEK acak 32-byte (256-bit)
    const dek = crypto.randomBytes(KEY_LENGTH_BYTES);

    // 2. Enkripsi plaintext menggunakan DEK
    const dataIv = crypto.randomBytes(IV_LENGTH_BYTES);
    const dataCipher = crypto.createCipheriv(AES_GCM_ALGORITHM, dek, dataIv);
    const dataInput = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf-8') : plaintext;
    const ct = Buffer.concat([dataCipher.update(dataInput), dataCipher.final()]);
    const dataTag = dataCipher.getAuthTag();

    // 3. Bungkus (wrap) DEK menggunakan KEK
    const dekIv = crypto.randomBytes(IV_LENGTH_BYTES);
    const dekCipher = crypto.createCipheriv(AES_GCM_ALGORITHM, kek, dekIv);
    const edek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekTag = dekCipher.getAuthTag();

    // 4. Susun envelope
    const payload: EncryptedPayload = {
      v: 1,
      kid: keyId,
      dekIv: dekIv.toString('base64'),
      dekTag: dekTag.toString('base64'),
      edek: edek.toString('base64'),
      iv: dataIv.toString('base64'),
      tag: dataTag.toString('base64'),
      ct: ct.toString('base64'),
    };

    const serializedJson = JSON.stringify(payload);
    return `${ENVELOPE_PREFIX}${Buffer.from(serializedJson, 'utf-8').toString('base64')}`;
  }

  /**
   * Mendekripsi payload kolom terenkripsi:
   * 1. Validasi struktur envelope dan integritas prefix.
   * 2. Buka bungkus DEK menggunakan KEK yang tertera di payload (`kid`).
   * 3. Dekripsi ciphertext data menggunakan DEK dan verifikasi authentication tag.
   */
  public decrypt(serializedPayload: string): string {
    if (!serializedPayload.startsWith(ENVELOPE_PREFIX)) {
      throw new Error(
        '[CryptoError] Format payload tidak dikenali (missing envelope prefix enc:v1:)',
      );
    }

    const base64Data = serializedPayload.slice(ENVELOPE_PREFIX.length);
    let payload: EncryptedPayload;

    try {
      const jsonStr = Buffer.from(base64Data, 'base64').toString('utf-8');
      payload = JSON.parse(jsonStr) as EncryptedPayload;
    } catch {
      throw new Error('[CryptoError] Gagal membaca metadata JSON envelope terenkripsi');
    }

    if (
      payload.v !== 1 ||
      !payload.kid ||
      !payload.edek ||
      !payload.dekIv ||
      !payload.dekTag ||
      !payload.iv ||
      !payload.tag ||
      !payload.ct
    ) {
      throw new Error('[CryptoError] Struktur envelope tidak lengkap atau versi tidak didukung');
    }

    // Ambil KEK sesuai keyId dalam payload
    const kek = this.getKek(payload.kid);

    // 1. Dekripsi DEK
    let dek: Buffer;
    try {
      const dekDecipher = crypto.createDecipheriv(
        AES_GCM_ALGORITHM,
        kek,
        Buffer.from(payload.dekIv, 'base64'),
      );
      dekDecipher.setAuthTag(Buffer.from(payload.dekTag, 'base64'));
      dek = Buffer.concat([
        dekDecipher.update(Buffer.from(payload.edek, 'base64')),
        dekDecipher.final(),
      ]);
    } catch {
      throw new Error(
        '[CryptoError] Integritas DEK gagal diverifikasi! Kunci KEK salah atau payload telah dimanipulasi.',
      );
    }

    // 2. Dekripsi data menggunakan DEK
    try {
      const dataDecipher = crypto.createDecipheriv(
        AES_GCM_ALGORITHM,
        dek,
        Buffer.from(payload.iv, 'base64'),
      );
      dataDecipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
      const plaintext = Buffer.concat([
        dataDecipher.update(Buffer.from(payload.ct, 'base64')),
        dataDecipher.final(),
      ]);
      return plaintext.toString('utf-8');
    } catch {
      throw new Error(
        '[CryptoError] Integritas data gagal diverifikasi! Ciphertext atau tag telah dimodifikasi (tampered).',
      );
    }
  }

  /**
   * Melakukan re-enkripsi data dengan keyId KEK terbaru (rotasi kunci).
   */
  public rotate(serializedPayload: string, newKeyId?: string): string {
    const plaintext = this.decrypt(serializedPayload);
    return this.encrypt(plaintext, { keyId: newKeyId || this.defaultKeyId });
  }

  // ===========================================================================
  // 2. BLIND INDEX (HMAC-SHA256 DENGAN NORMALISASI)
  // ===========================================================================

  /**
   * Menormalisasi nilai sebelum di-hash agar variasi format (spasi, tanda hubung, titik, kapitalisasi)
   * tetap menghasilkan blind index yang identik untuk pencarian eksak / deduplikasi.
   */
  public normalizeForBlindIndex(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        // Hapus karakter pemisah umum: spasi, tanda minus, titik, garis miring, koma, underscore
        .replace(/[\s\-_./,\\]+/g, '')
    );
  }

  /**
   * Menghasilkan blind index HMAC-SHA256 untuk kolom *_hash.
   * Menggunakan salt/key terpisah dari KEK/DEK untuk mencegah korelasi kriptografis.
   */
  public computeBlindIndex(value: string, customSalt?: string): string {
    const salt = customSalt || this.blindIndexSalt;
    const normalized = this.normalizeForBlindIndex(value);
    return crypto.createHmac('sha256', salt).update(normalized).digest('hex');
  }

  // ===========================================================================
  // 3. HASH KATA SANDI (ARGON2ID)
  // ===========================================================================

  /**
   * Melakukan hashing kata sandi dengan algoritma Argon2id (OWASP recommendation).
   */
  public async hashPassword(password: string, options?: Argon2Options): Promise<string> {
    const opts = { ...this.argon2Defaults, ...options };
    return hash(password, {
      algorithm: Algorithm.Argon2id,
      memoryCost: opts.memoryCost,
      timeCost: opts.timeCost,
      parallelism: opts.parallelism,
      outputLen: opts.outputLen,
    });
  }

  /**
   * Memverifikasi kata sandi terhadap hash Argon2id (constant-time).
   */
  public async verifyPassword(hashedPassword: string, candidate: string): Promise<boolean> {
    try {
      return await verify(hashedPassword, candidate);
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // 4. GENERATOR TOKEN & HASH TOKEN
  // ===========================================================================

  /**
   * Menghasilkan token acak berkekuatan kriptografis tinggi (default 256-bit = 32 bytes)
   * beserta hash SHA-256 untuk disimpan di database.
   */
  public generateSecureToken(bytes: number = 32): { token: string; hash: string } {
    const token = crypto.randomBytes(bytes).toString('hex');
    const tokenHash = this.hashToken(token);
    return { token, hash: tokenHash };
  }

  /**
   * Menghasilkan hash SHA-256 dari sebuah token (misal refresh token, session token, reset token).
   * Token disimpan dalam bentuk hash di database agar jika DB bocor, token mentah tidak dapat dipakai.
   */
  public hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // ===========================================================================
  // 5. PERBANDINGAN KONSTAN (TIMING-SAFE EQUAL)
  // ===========================================================================

  /**
   * Membandingkan dua string rahasia dalam waktu konstan (constant-time)
   * untuk mencegah serangan timing-attack.
   */
  public timingSafeEqual(a: string | Buffer, b: string | Buffer): boolean {
    const bufA = typeof a === 'string' ? Buffer.from(a, 'utf-8') : a;
    const bufB = typeof b === 'string' ? Buffer.from(b, 'utf-8') : b;

    if (bufA.length !== bufB.length) {
      // Jalankan dummy comparison agar waktu eksekusi tidak langsung kembali jika panjang beda
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }
}
