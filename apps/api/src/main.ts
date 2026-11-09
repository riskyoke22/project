import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './common/config/env.config';
import { AppLogger } from './common/logger/logger.service';

async function bootstrap() {
  // 1. Validasi konfigurasi runtime dengan Zod (Gagal start jika ada variabel tidak valid)
  const env = validateEnv();

  // 2. Inisialisasi NestJS Application
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  // 3. Graceful shutdown hooks
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
