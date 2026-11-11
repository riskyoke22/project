import { Injectable } from '@nestjs/common';
import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Database
  DATABASE_URL: z
    .string()
    .min(
      1,
      'DATABASE_URL wajib diisi (contoh: postgresql://postgres:postgres@127.0.0.1:5432/sistem_db)',
    ),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL wajib diisi (contoh: redis://127.0.0.1:6379)'),

  // MinIO / S3 Storage
  MINIO_ENDPOINT: z.string().min(1).default('127.0.0.1'),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  MINIO_ACCESS_KEY: z.string().min(1, 'MINIO_ACCESS_KEY wajib diisi'),
  MINIO_SECRET_KEY: z.string().min(1, 'MINIO_SECRET_KEY wajib diisi'),
  MINIO_BUCKET_NAME: z.string().default('sistem-terintegrasi-files'),

  // Keamanan Kriptografi: Root KEK (Key Encryption Key) & Secrets
  APP_SECRET: z
    .string()
    .min(32, 'APP_SECRET minimal harus 32 karakter untuk memastikan entropi enkripsi'),
  KEY_ID: z.string().default('kek-v1'),
  BLIND_INDEX_SALT: z
    .string()
    .min(16, 'BLIND_INDEX_SALT minimal harus 16 karakter')
    .default('blind-index-default-salt-minimum-16-chars'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET minimal harus 32 karakter')
    .default('jwt-access-secret-default-change-in-production-min-32-chars!'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET minimal harus 32 karakter')
    .default('jwt-refresh-secret-default-change-in-production-min-32-chars!'),

  // Parameter Argon2id
  ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(19456), // 19 MiB
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  // Keamanan HTTP & Rate Limiting
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  RATE_LIMIT_TTL_SEC: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cachedEnv: AppEnv | null = null;

/**
 * Memvalidasi variabel lingkungan proses menggunakan skema Zod.
 * Aplikasi akan gagal start (throw error) jika ada variabel yang tidak valid atau kurang.
 */
export function validateEnv(rawEnv: Record<string, unknown> = process.env): AppEnv {
  const result = EnvSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - [${err.path.join('.')}]: ${err.message}`)
      .join('\n');

    const errorMessage = `[ConfigValidationError] Konfigurasi lingkungan gagal divalidasi:\n${errorDetails}\n\nAplikasi dihentikan demi keamanan. Periksa file .env atau environment runtime.`;
    throw new Error(errorMessage);
  }

  cachedEnv = result.data;
  return result.data;
}

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    return validateEnv(process.env);
  }
  return cachedEnv;
}

/**
 * Provider konfigurasi terkelola untuk dependency injection NestJS.
 * Memastikan tidak ada modul di luar common/config yang mengakses `process.env` langsung.
 */
@Injectable()
export class AppConfigService {
  private readonly env: AppEnv;

  constructor() {
    this.env = getEnv();
  }

  get<K extends keyof AppEnv>(key: K): AppEnv[K] {
    return this.env[key];
  }

  getAll(): Readonly<AppEnv> {
    return Object.freeze({ ...this.env });
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
}
