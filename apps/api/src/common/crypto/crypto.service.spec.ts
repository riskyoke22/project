import { describe, expect, it, beforeEach } from 'vitest';
import { CryptoService } from './crypto.service';
import { AppConfigService, validateEnv } from '../config/env.config';

describe('CryptoService - Enkripsi Envelope, Blind Index, & Password Hashing', () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    validateEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/sistem_db',
      REDIS_URL: 'redis://127.0.0.1:6379',
      MINIO_ENDPOINT: '127.0.0.1',
      MINIO_PORT: '9000',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin_secret',
      APP_SECRET: 'kunci-rahasia-kek-primer-32-karakter-panjang!',
      KEY_ID: 'kek-v1',
      BLIND_INDEX_SALT: 'salt-kunci-blind-index-minimal-16',
      ARGON2_MEMORY_COST: '1024', // Ringan khusus pengujian cepat
      ARGON2_TIME_COST: '1',
      ARGON2_PARALLELISM: '1',
    });

    const configService = new AppConfigService();
    cryptoService = new CryptoService(configService);
  });

  describe('Enkripsi Envelope AES-256-GCM', () => {
    it('berhasil melakukan round-trip encrypt dan decrypt data sensitif', () => {
      const sensitiveNik = '3201123456780001';
      const encrypted = cryptoService.encrypt(sensitiveNik);

      expect(encrypted).toContain('enc:v1:');
      expect(encrypted).not.toContain(sensitiveNik);

      const decrypted = cryptoService.decrypt(encrypted);
      expect(decrypted).toBe(sensitiveNik);
    });

    it('mendukung enkripsi karakter Unicode dan teks panjang', () => {
      const secretText = 'Pernyataan Rahasia: Pegawai Berprestasi 2026! 🚀🔒 @#$%^&*()';
      const encrypted = cryptoService.encrypt(secretText);
      const decrypted = cryptoService.decrypt(encrypted);
      expect(decrypted).toBe(secretText);
    });

    it('menghasilkan ciphertext yang berbeda untuk data yang sama (karena IV acak unik)', () => {
      const plaintext = '3201123456780001';
      const enc1 = cryptoService.encrypt(plaintext);
      const enc2 = cryptoService.encrypt(plaintext);

      expect(enc1).not.toBe(enc2);
      expect(cryptoService.decrypt(enc1)).toBe(plaintext);
      expect(cryptoService.decrypt(enc2)).toBe(plaintext);
    });

    it('menolak payload yang ciphertext-nya dirusak (tampered ciphertext)', () => {
      const plaintext = '3201123456780001';
      const encrypted = cryptoService.encrypt(plaintext);

      // Ambil JSON envelope di balik prefix
      const base64Data = encrypted.slice('enc:v1:'.length);
      const jsonStr = Buffer.from(base64Data, 'base64').toString('utf-8');
      const payload = JSON.parse(jsonStr);

      // Rusak satu byte pada ciphertext
      const ctBuf = Buffer.from(payload.ct, 'base64');
      ctBuf[0] ^= 0xff; // Modifikasi byte
      payload.ct = ctBuf.toString('base64');

      const tamperedEncrypted = `enc:v1:${Buffer.from(JSON.stringify(payload)).toString('base64')}`;

      expect(() => cryptoService.decrypt(tamperedEncrypted)).toThrowError(
        /Integritas data gagal diverifikasi/i,
      );
    });

    it('menolak payload yang tag otentikasinya dirusak (tampered auth tag)', () => {
      const plaintext = '3201123456780001';
      const encrypted = cryptoService.encrypt(plaintext);

      const base64Data = encrypted.slice('enc:v1:'.length);
      const payload = JSON.parse(Buffer.from(base64Data, 'base64').toString('utf-8'));

      // Rusak auth tag
      const tagBuf = Buffer.from(payload.tag, 'base64');
      tagBuf[tagBuf.length - 1] ^= 0x01;
      payload.tag = tagBuf.toString('base64');

      const tamperedEncrypted = `enc:v1:${Buffer.from(JSON.stringify(payload)).toString('base64')}`;

      expect(() => cryptoService.decrypt(tamperedEncrypted)).toThrowError(
        /Integritas data gagal diverifikasi/i,
      );
    });

    it('mendukung rotasi kunci KEK (membaca dengan KEK lama dan mengenkripsi ulang dengan KEK baru)', () => {
      const oldSecret = 'kunci-rahasia-kek-lama-versi-1-panjang!!';
      const newSecret = 'kunci-rahasia-kek-baru-versi-2-panjang!!';

      cryptoService.registerKek('kek-2025', oldSecret);
      cryptoService.registerKek('kek-2026', newSecret);

      const plaintext = '081234567890';
      // Enkripsi dengan KEK lama
      const encryptedOld = cryptoService.encrypt(plaintext, { keyId: 'kek-2025' });

      // Verifikasi bisa dibaca
      expect(cryptoService.decrypt(encryptedOld)).toBe(plaintext);

      // Putar kunci ke KEK baru
      const rotated = cryptoService.rotate(encryptedOld, 'kek-2026');
      expect(cryptoService.decrypt(rotated)).toBe(plaintext);

      // Pastikan payload baru menggunakan kek-2026
      const payloadJson = Buffer.from(rotated.slice('enc:v1:'.length), 'base64').toString('utf-8');
      expect(JSON.parse(payloadJson).kid).toBe('kek-2026');
    });

    it('menolak payload jika KEK key_id tidak terdaftar', () => {
      const encrypted = cryptoService.encrypt('data-sensitif');
      const base64Data = encrypted.slice('enc:v1:'.length);
      const payload = JSON.parse(Buffer.from(base64Data, 'base64').toString('utf-8'));
      payload.kid = 'kek-tidak-diketahui-2099';

      const invalidKidEncrypted = `enc:v1:${Buffer.from(JSON.stringify(payload)).toString('base64')}`;

      expect(() => cryptoService.decrypt(invalidKidEncrypted)).toThrowError(
        /KEK dengan key_id 'kek-tidak-diketahui-2099' tidak ditemukan/i,
      );
    });
  });

  describe('Blind Index (HMAC-SHA256 dengan Normalisasi)', () => {
    it('menghasilkan blind index yang identik untuk nilai berformat berbeda (normalisasi)', () => {
      const raw1 = '  3201-1234.5678-0001  ';
      const raw2 = '3201123456780001';
      const raw3 = '3201/1234/5678/0001';

      const hash1 = cryptoService.computeBlindIndex(raw1);
      const hash2 = cryptoService.computeBlindIndex(raw2);
      const hash3 = cryptoService.computeBlindIndex(raw3);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).toHaveLength(64); // SHA-256 hex output
    });

    it('menghasilkan hash yang berbeda untuk nilai data yang berbeda', () => {
      const hashA = cryptoService.computeBlindIndex('3201123456780001');
      const hashB = cryptoService.computeBlindIndex('3201123456780002');
      expect(hashA).not.toBe(hashB);
    });

    it('menghasilkan hash yang berbeda bila salt berbeda', () => {
      const value = 'pegawai@organisasi.id';
      const hashSalt1 = cryptoService.computeBlindIndex(value, 'salt-pertama-123456');
      const hashSalt2 = cryptoService.computeBlindIndex(value, 'salt-kedua-654321');
      expect(hashSalt1).not.toBe(hashSalt2);
    });
  });

  describe('Password Hashing (Argon2id)', () => {
    it('berhasil melakukan hash dan verifikasi kata sandi dengan Argon2id', async () => {
      const password = 'PasswordKuat123!#';
      const hashedPassword = await cryptoService.hashPassword(password);

      expect(hashedPassword).toMatch(/^\$argon2id\$/);

      const isValid = await cryptoService.verifyPassword(hashedPassword, password);
      expect(isValid).toBe(true);

      const isInvalid = await cryptoService.verifyPassword(hashedPassword, 'PasswordSalah!');
      expect(isInvalid).toBe(false);
    });
  });

  describe('Generator Token Acak & Hash Token', () => {
    it('menghasilkan token acak 256-bit dan hash SHA-256 yang tepat', () => {
      const { token, hash: tokenHash } = cryptoService.generateSecureToken(32);
      expect(token).toHaveLength(64); // 32 bytes hex = 64 chars
      expect(tokenHash).toHaveLength(64);

      // Verifikasi hash konsisten
      expect(cryptoService.hashToken(token)).toBe(tokenHash);
    });
  });

  describe('Constant-Time Comparison', () => {
    it('mengembalikan true untuk string identik dan false untuk yang berbeda', () => {
      expect(cryptoService.timingSafeEqual('kunci-rahasia-123', 'kunci-rahasia-123')).toBe(true);
      expect(cryptoService.timingSafeEqual('kunci-rahasia-123', 'kunci-rahasia-999')).toBe(false);
      expect(cryptoService.timingSafeEqual('pendek', 'panjang-sekali')).toBe(false);
    });
  });
});
