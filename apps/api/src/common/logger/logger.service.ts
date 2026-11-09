import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger as PinoLoggerInstance } from 'pino';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: PinoLoggerInstance;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
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
          'identity_number',
          '*.identity_number',
          'secret',
          '*.secret',
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
