import { NestFactory } from '@nestjs/core';
import express from 'express';
import { AppModule } from './app.module';
import { AppConfigService, validateEnv } from './common/config/env.config';
import { AppLogger } from './common/logger/logger.service';
import { createHelmetMiddleware } from './common/security/helmet.config';
import { createCorsOptions } from './common/security/cors.config';

async function bootstrap() {
  // 1. Validasi konfigurasi runtime dengan Zod (Gagal start jika ada variabel tidak valid)
  const env = validateEnv();

  // 2. Inisialisasi NestJS Application
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLogger);
  const config = app.get(AppConfigService);
  app.useLogger(logger);

  // 3. Keamanan HTTP: Helmet (CSP, HSTS, frameguard) & CORS Whitelist
  app.use(createHelmetMiddleware());
  app.enableCors(createCorsOptions(config));

  // 4. Pembatasan ukuran payload body (mencegah DoS memory flooding)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 5. Graceful shutdown hooks
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  logger.log(
    `Aplikasi Backend API berjalan di port ${env.PORT} (mode: ${env.NODE_ENV})`,
    'Bootstrap',
  );
}

bootstrap().catch((err: Error) => {
  // eslint-disable-next-line no-console
  console.error('[FATAL STARTUP ERROR]', err.message);
  process.exit(1);
});
