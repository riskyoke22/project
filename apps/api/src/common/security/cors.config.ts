import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppConfigService } from '../config/env.config';

/**
 * Konfigurasi CORS dengan daftar putih (whitelist) origin yang ketat.
 */
export function createCorsOptions(config: AppConfigService): CorsOptions {
  const allowedOrigins = config.corsOrigins;

  return {
    origin: (origin, callback) => {
      // Izinkan permintaan tanpa origin (seperti mobile apps, curl, atau komunikasi server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed === origin) return true;
        // Izinkan subdomain jika didaftarkan dengan wildcard
        if (allowed.startsWith('*.') && origin.endsWith(allowed.slice(2))) return true;
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(
          new Error(`[CorsSecurityError] Origin '${origin}' tidak diizinkan oleh kebijakan CORS.`),
        );
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Request-ID'],
    credentials: true, // Wajib true untuk pengiriman cookie sesi httpOnly
    maxAge: 3600, // Cache pre-flight response selama 1 jam
  };
}
