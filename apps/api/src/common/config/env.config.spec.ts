import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.config';

describe('Environment Configuration Validation (Zod)', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: '4000',
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/sistem_db',
    REDIS_URL: 'redis://127.0.0.1:6379',
    MINIO_ENDPOINT: '127.0.0.1',
    MINIO_PORT: '9000',
    MINIO_USE_SSL: 'false',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin_secret',
    MINIO_BUCKET_NAME: 'sistem-terintegrasi-files',
    APP_SECRET: 'kunci-rahasia-minimal-32-karakter-harus-panjang!',
  };

  it('berhasil memvalidasi konfigurasi yang lengkap dan valid', () => {
    const parsed = validateEnv(validEnv);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.PORT).toBe(4000);
    expect(parsed.MINIO_PORT).toBe(9000);
    expect(parsed.MINIO_USE_SSL).toBe(false);
  });

  it('gagal ketika DATABASE_URL kosong', () => {
    const invalidEnv = { ...validEnv, DATABASE_URL: '' };
    expect(() => validateEnv(invalidEnv)).toThrowError(/DATABASE_URL wajib diisi/);
  });

  it('gagal ketika APP_SECRET kurang dari 32 karakter', () => {
    const invalidEnv = { ...validEnv, APP_SECRET: 'terlalu-pendek' };
    expect(() => validateEnv(invalidEnv)).toThrowError(/APP_SECRET minimal harus 32 karakter/);
  });

  it('gagal ketika NODE_ENV tidak sesuai pilihan enum', () => {
    const invalidEnv = { ...validEnv, NODE_ENV: 'invalid_mode' };
    expect(() => validateEnv(invalidEnv)).toThrowError(/NODE_ENV/);
  });
});
