import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

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

  // Keamanan: Kunci Enkripsi Root (KEK / App Secret)
  APP_SECRET: z
    .string()
    .min(32, 'APP_SECRET minimal harus 32 karakter untuk memastikan entropi enkripsi'),
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
