import { Injectable, LoggerService, Optional } from '@nestjs/common';
import pino, { Logger as PinoLoggerInstance } from 'pino';
import { AppConfigService, getEnv } from '../config/env.config';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: PinoLoggerInstance;

  constructor(@Optional() private readonly config?: AppConfigService) {
    let logLevel = 'debug';
    try {
      const env = this.config ? this.config.getAll() : getEnv();
      logLevel = env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug');
    } catch {
      // Fallback aman untuk unit test terisolasi di mana environment belum diinisialisasi
      logLevel = 'debug';
    }

    this.logger = pino({
      level: logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'password',
          '*.password',
          'token',
          '*.token',
          'refreshToken',
          '*.refreshToken',
          'nik',
          '*.nik',
          'national_id',
          '*.national_id',
          'identity_number',
          '*.identity_number',
          'secret',
          '*.secret',
          'mfa_secret',
          '*.mfa_secret',
          '*_enc',
          '*.*_enc',
          'phone_enc',
          '*.phone_enc',
          'email_enc',
          '*.email_enc',
          'nik_enc',
          '*.nik_enc',
        ],
        censor: '[REDACTED]',
      },
    });
  }

  log(message: unknown, context?: string, extra?: Record<string, unknown>) {
    this.logger.info(
      { context, ...extra },
      typeof message === 'string' ? message : JSON.stringify(message),
    );
  }

  error(message: unknown, trace?: string, context?: string, extra?: Record<string, unknown>) {
    this.logger.error(
      { context, trace, ...extra },
      typeof message === 'string' ? message : JSON.stringify(message),
    );
  }

  warn(message: unknown, context?: string, extra?: Record<string, unknown>) {
    this.logger.warn(
      { context, ...extra },
      typeof message === 'string' ? message : JSON.stringify(message),
    );
  }

  debug(message: unknown, context?: string, extra?: Record<string, unknown>) {
    this.logger.debug(
      { context, ...extra },
      typeof message === 'string' ? message : JSON.stringify(message),
    );
  }

  getPino(): PinoLoggerInstance {
    return this.logger;
  }
}
