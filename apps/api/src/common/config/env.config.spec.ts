import { describe, expect, it } from 'vitest';
import { validateEnv, AppConfigService } from './env.config';

describe('Environment Configuration Validation (Zod)', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: '4000',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/sistem_db',
    REDIS_URL: 'redis://127.0.0.1:6379',
    MINIO_ENDPOINT: '127.0.0.1',
    MINIO_PORT: '9000',
    MINIO_USE_SSL: 'false',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin_secret',
    MINIO_BUCKET_NAME: 'sistem-terintegrasi-files',
    APP_SECRET: 'kunci-rahasia-minimal-32-karakter-harus-panjang!',
    KEY_ID: 'kek-2026-v1',
    BLIND_INDEX_SALT: 'salt-kunci-blind-index-minimal-16',
    JWT_ACCESS_SECRET: 'jwt-access-secret-harus-minimal-32-karakter-panjang!',
    JWT_REFRESH_SECRET: 'jwt-refresh-secret-harus-minimal-32-karakter-panjang!',
    CORS_ORIGINS: 'http://localhost:3000,http://app.internal:3000',
  };

  it('berhasil memvalidasi konfigurasi yang lengkap dan valid', () => {
    const parsed = validateEnv(validEnv);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.PORT).toBe(4000);
    expect(parsed.MINIO_PORT).toBe(9000);
    expect(parsed.MINIO_USE_SSL).toBe(false);
    expect(parsed.KEY_ID).toBe('kek-2026-v1');
    expect(parsed.ARGON2_MEMORY_COST).toBe(19456);
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

  it('AppConfigService mengembalikan nilai konfigurasi yang tepat dan bertipe', () => {
    validateEnv(validEnv);
    const service = new AppConfigService();
    expect(service.get('PORT')).toBe(4000);
    expect(service.isTest).toBe(true);
    expect(service.isProduction).toBe(false);
    expect(service.corsOrigins).toEqual(['http://localhost:3000', 'http://app.internal:3000']);
  });
});
