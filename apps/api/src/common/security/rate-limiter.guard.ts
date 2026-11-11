import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/env.config';
import { RateLimitError } from '../errors/app-error';

interface RateBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly buckets: Map<string, RateBucket> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(private readonly config: AppConfigService) {
    this.windowMs = this.config.get('RATE_LIMIT_TTL_SEC') * 1000;
    this.maxRequests = this.config.get('RATE_LIMIT_MAX');

    // Pembersihan berkala setiap 5 menit agar memori tidak leak
    const timer = setInterval(
      () => {
        const now = Date.now();
        for (const [key, bucket] of this.buckets.entries()) {
          if (bucket.resetAt <= now) {
            this.buckets.delete(key);
          }
        }
      },
      5 * 60 * 1000,
    );

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      request.socket?.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    let bucket = this.buckets.get(clientIp);

    if (!bucket || bucket.resetAt <= now) {
      bucket = {
        count: 1,
        resetAt: now + this.windowMs,
      };
      this.buckets.set(clientIp, bucket);
      return true;
    }

    bucket.count += 1;

    if (bucket.count > this.maxRequests) {
      throw new RateLimitError(
        `Terlalu banyak permintaan dari IP Anda. Batas maksimal ${this.maxRequests} permintaan per ${
          this.windowMs / 1000
        } detik.`,
      );
    }

    return true;
  }

  /** Metode helper untuk testing: reset bucket */
  public resetBuckets(): void {
    this.buckets.clear();
  }
}
