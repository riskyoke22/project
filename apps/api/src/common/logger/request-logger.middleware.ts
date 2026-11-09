import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppLogger } from './logger.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const rawRequestId = req.headers['x-request-id'];
    const requestId =
      typeof rawRequestId === 'string' && rawRequestId.trim() !== ''
        ? rawRequestId.trim()
        : uuidv4();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const startTime = Date.now();
    const pino = this.logger.getPino();

    res.on('finish', () => {
      const responseTimeMs = Date.now() - startTime;
      const { method, originalUrl, ip } = req;
      const { statusCode } = res;

      pino.info(
        {
          request_id: requestId,
          method,
          url: originalUrl,
          statusCode,
          responseTimeMs,
          clientIp: ip,
        },
        `HTTP ${method} ${originalUrl} ${statusCode} - ${responseTimeMs}ms`,
      );
    });

    next();
  }
}
