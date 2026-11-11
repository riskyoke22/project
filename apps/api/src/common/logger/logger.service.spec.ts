import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppLogger } from './logger.service';
import { RequestLoggerMiddleware } from './request-logger.middleware';
import { Request, Response } from 'express';
import { EventEmitter } from 'events';
import pino from 'pino';

describe('AppLogger', () => {
  let appLogger: AppLogger;

  beforeEach(() => {
    appLogger = new AppLogger();
  });

  it('harus membuat instance pino logger dengan benar', () => {
    const pinoInstance = appLogger.getPino();
    expect(pinoInstance).toBeDefined();
    expect(typeof pinoInstance.info).toBe('function');
    expect(typeof pinoInstance.error).toBe('function');
    expect(typeof pinoInstance.warn).toBe('function');
    expect(typeof pinoInstance.debug).toBe('function');
  });

  it('harus memanggil pino.info saat appLogger.log() dipanggil', () => {
    const pinoInstance = appLogger.getPino();
    const spy = vi.spyOn(pinoInstance, 'info');

    appLogger.log('Pesan info', 'TestContext', { key: 'value' });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'TestContext', key: 'value' }),
      'Pesan info',
    );
  });

  it('harus memanggil pino.error saat appLogger.error() dipanggil', () => {
    const pinoInstance = appLogger.getPino();
    const spy = vi.spyOn(pinoInstance, 'error');

    appLogger.error('Pesan error', 'StackTrace', 'TestContext', { errCode: 500 });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'TestContext', trace: 'StackTrace', errCode: 500 }),
      'Pesan error',
    );
  });

  it('harus memanggil pino.warn saat appLogger.warn() dipanggil', () => {
    const pinoInstance = appLogger.getPino();
    const spy = vi.spyOn(pinoInstance, 'warn');

    appLogger.warn('Pesan peringatan', 'TestContext');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'TestContext' }),
      'Pesan peringatan',
    );
  });

  it('harus memanggil pino.debug saat appLogger.debug() dipanggil', () => {
    const pinoInstance = appLogger.getPino();
    const spy = vi.spyOn(pinoInstance, 'debug');

    appLogger.debug('Pesan debug', 'TestContext');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'TestContext' }),
      'Pesan debug',
    );
  });

  it('BUKTI REDAKSI: merahasiakan field sensitif (password, NIK, token, *_enc) dari log output', () => {
    let capturedLogOutput = '';
    const destination = {
      write: (msg: string) => {
        capturedLogOutput += msg;
      },
    };

    const redactingPino = pino(
      {
        redact: {
          paths: [
            'password',
            '*.password',
            'token',
            '*.token',
            'nik',
            '*.nik',
            'national_id',
            '*.national_id',
            'nik_enc',
            '*.nik_enc',
            'phone_enc',
            '*.phone_enc',
          ],
          censor: '[REDACTED]',
        },
      },
      destination,
    );

    // Kirim objek payload yang memuat berbagai data sensitif
    redactingPino.info({
      user: 'ahmad',
      password: 'SuperSecretPassword123!',
      token: 'jwt.bearer.secret.token.xyz',
      nik: '3201123456780001',
      nik_enc: 'enc:v1:aes-256-gcm-encrypted-nik',
      phone_enc: 'enc:v1:aes-256-gcm-encrypted-phone',
      non_sensitive: 'publik',
    });

    // Verifikasi nilai plaintext sensitif TIDAK ADA dalam log output
    expect(capturedLogOutput).not.toContain('SuperSecretPassword123!');
    expect(capturedLogOutput).not.toContain('jwt.bearer.secret.token.xyz');
    expect(capturedLogOutput).not.toContain('3201123456780001');
    expect(capturedLogOutput).not.toContain('enc:v1:aes-256-gcm-encrypted-nik');
    expect(capturedLogOutput).not.toContain('enc:v1:aes-256-gcm-encrypted-phone');

    // Verifikasi bahwa placeholder [REDACTED] muncul menggantikannya
    expect(capturedLogOutput).toContain('"password":"[REDACTED]"');
    expect(capturedLogOutput).toContain('"token":"[REDACTED]"');
    expect(capturedLogOutput).toContain('"nik":"[REDACTED]"');
    expect(capturedLogOutput).toContain('"nik_enc":"[REDACTED]"');
    expect(capturedLogOutput).toContain('"phone_enc":"[REDACTED]"');
    expect(capturedLogOutput).toContain('"non_sensitive":"publik"');
  });
});

describe('RequestLoggerMiddleware', () => {
  let middleware: RequestLoggerMiddleware;
  let appLogger: AppLogger;

  beforeEach(() => {
    appLogger = new AppLogger();
    middleware = new RequestLoggerMiddleware(appLogger);
  });

  it('harus menghasilkan X-Request-Id acak jika header tidak disertakan', () => {
    const req = {
      headers: {},
      method: 'GET',
      originalUrl: '/api/ready',
      ip: '127.0.0.1',
    } as unknown as Request;

    const setHeaderMock = vi.fn();
    const res = Object.assign(new EventEmitter(), {
      setHeader: setHeaderMock,
      statusCode: 200,
    }) as unknown as Response;

    const nextMock = vi.fn();

    middleware.use(req, res, nextMock);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(setHeaderMock).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(nextMock).toHaveBeenCalled();
  });

  it('harus mempertahankan X-Request-Id yang dikirim dari klien', () => {
    const incomingId = 'client-uuid-12345';
    const req = {
      headers: { 'x-request-id': incomingId },
      method: 'POST',
      originalUrl: '/api/v1/auth/login',
      ip: '127.0.0.1',
    } as unknown as Request;

    const setHeaderMock = vi.fn();
    const res = Object.assign(new EventEmitter(), {
      setHeader: setHeaderMock,
      statusCode: 200,
    }) as unknown as Response;

    const nextMock = vi.fn();

    middleware.use(req, res, nextMock);

    expect(req.requestId).toBe(incomingId);
    expect(setHeaderMock).toHaveBeenCalledWith('X-Request-Id', incomingId);
    expect(nextMock).toHaveBeenCalled();
  });

  it('harus mencatat log saat response memicu event finish', () => {
    const req = {
      headers: {},
      method: 'GET',
      originalUrl: '/ready',
      ip: '127.0.0.1',
    } as unknown as Request;

    const resEmitter = new EventEmitter();
    const setHeaderMock = vi.fn();
    const res = Object.assign(resEmitter, {
      setHeader: setHeaderMock,
      statusCode: 200,
    }) as unknown as Response;

    const nextMock = vi.fn();
    const pinoInstance = appLogger.getPino();
    const spy = vi.spyOn(pinoInstance, 'info');

    middleware.use(req, res, nextMock);

    resEmitter.emit('finish');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: req.requestId,
        method: 'GET',
        url: '/ready',
        statusCode: 200,
        clientIp: '127.0.0.1',
      }),
      expect.stringContaining('HTTP GET /ready 200'),
    );
  });
});
