import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppConfigService } from '../config/env.config';
import { ForbiddenError } from '../errors/app-error';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly allowedOrigins: Set<string>;

  constructor(private readonly config: AppConfigService) {
    this.allowedOrigins = new Set(this.config.corsOrigins);
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Metode aman (GET, HEAD, OPTIONS) tidak memerlukan validasi CSRF
    if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
      return next();
    }

    const originHeader = req.headers.origin || req.headers.referer;

    // Jika origin header ada, validasi terhadap origin yang diizinkan
    if (originHeader) {
      let originHost: string;
      try {
        const parsed = new URL(originHeader);
        originHost = `${parsed.protocol}//${parsed.host}`;
      } catch {
        throw new ForbiddenError(
          'Format Origin/Referer tidak valid (CSRF Defense).',
          'CSRF_INVALID_ORIGIN_FORMAT',
        );
      }

      const isWhitelisted = Array.from(this.allowedOrigins).some((allowed) => {
        if (allowed === originHost) return true;
        if (allowed.startsWith('*.') && originHost.endsWith(allowed.slice(2))) return true;
        return false;
      });

      if (!isWhitelisted) {
        throw new ForbiddenError(
          `Permintaan ditolak: Origin '${originHost}' tidak terdaftar dalam whitelist (CSRF Protection).`,
          'CSRF_ORIGIN_NOT_ALLOWED',
        );
      }
    }

    return next();
  }
}
