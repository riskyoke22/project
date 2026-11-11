import { describe, expect, it, beforeEach } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppConfigService, validateEnv } from '../config/env.config';
import { createCorsOptions } from './cors.config';
import { CsrfMiddleware } from './csrf.middleware';
import { RateLimiterGuard } from './rate-limiter.guard';
import { ForbiddenError, RateLimitError } from '../errors/app-error';

describe('HTTP Security (CORS, CSRF, & Rate Limiter)', () => {
  let configService: AppConfigService;

  beforeEach(() => {
    validateEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/sistem_db',
      REDIS_URL: 'redis://127.0.0.1:6379',
      MINIO_ENDPOINT: '127.0.0.1',
      MINIO_PORT: '9000',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin_secret',
      APP_SECRET: 'kunci-rahasia-minimal-32-karakter-harus-panjang!',
      CORS_ORIGINS: 'http://localhost:3000,http://app.internal:3000',
      RATE_LIMIT_TTL_SEC: '60',
      RATE_LIMIT_MAX: '5', // Batas kecil untuk pengujian
    });

    configService = new AppConfigService();
  });

  describe('CORS Whitelist Options', () => {
    it('mengizinkan origin yang terdaftar dalam whitelist', () => {
      const corsOptions = createCorsOptions(configService);
      const originFn = corsOptions.origin as (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => void;

      originFn('http://localhost:3000', (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
      });
    });

    it('menolak origin yang tidak terdaftar dalam whitelist', () => {
      const corsOptions = createCorsOptions(configService);
      const originFn = corsOptions.origin as (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => void;

      originFn('http://malicious-website.com', (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toContain('tidak diizinkan oleh kebijakan CORS');
      });
    });
  });

  describe('CSRF Middleware', () => {
    let csrfMiddleware: CsrfMiddleware;

    beforeEach(() => {
      csrfMiddleware = new CsrfMiddleware(configService);
    });

    it('mengizinkan metode aman (GET, HEAD, OPTIONS) tanpa memeriksa Origin', () => {
      let nextCalled = false;
      const req = { method: 'GET', headers: {} } as Request;
      const res = {} as Response;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      csrfMiddleware.use(req, res, next);
      expect(nextCalled).toBe(true);
    });

    it('mengizinkan mutasi (POST) dengan origin yang valid dalam whitelist', () => {
      let nextCalled = false;
      const req = {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
      } as unknown as Request;
      const res = {} as Response;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      csrfMiddleware.use(req, res, next);
      expect(nextCalled).toBe(true);
    });

    it('menolak mutasi (POST) dari origin yang tidak dikenal (CSRF Attack)', () => {
      const req = {
        method: 'POST',
        headers: { origin: 'http://evil-attacker.com' },
      } as unknown as Request;
      const res = {} as Response;
      const next: NextFunction = () => {};

      expect(() => csrfMiddleware.use(req, res, next)).toThrowError(ForbiddenError);
      expect(() => csrfMiddleware.use(req, res, next)).toThrowError(/CSRF/);
    });
  });

  describe('Rate Limiter Guard', () => {
    let rateLimiter: RateLimiterGuard;

    beforeEach(() => {
      rateLimiter = new RateLimiterGuard(configService);
    });

    it('mengizinkan permintaan dalam batas kuota dan melempar RateLimitError saat batas terlampaui', () => {
      const createMockContext = (ip: string): ExecutionContext => {
        return {
          switchToHttp: () => ({
            getRequest: () => ({
              headers: {},
              ip,
            }),
          }),
        } as unknown as ExecutionContext;
      };

      const ctx = createMockContext('192.168.1.50');

      // Kuota adalah 5
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.canActivate(ctx)).toBe(true);
      }

      // Permintaan ke-6 harus ditolak
      expect(() => rateLimiter.canActivate(ctx)).toThrowError(RateLimitError);
      expect(() => rateLimiter.canActivate(ctx)).toThrowError(/Batas maksimal 5 permintaan/);
    });
  });
});
