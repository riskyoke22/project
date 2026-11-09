import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppLogger } from './logger.service';
import { RequestLoggerMiddleware } from './request-logger.middleware';
import { Request, Response } from 'express';
import { EventEmitter } from 'events';

describe('AppLogger', () => {
  let appLogger: AppLogger;

  beforeEach(() => {
    appLogger = new AppLogger();
  });

  it('harus membuat instance pino logger dengan benar', () => {
    const pino = appLogger.getPino();
    expect(pino).toBeDefined();
    expect(typeof pino.info).toBe('function');
    expect(typeof pino.error).toBe('function');
    expect(typeof pino.warn).toBe('function');
    expect(typeof pino.debug).toBe('function');
  });

  it('harus memanggil pino.info saat appLogger.log() dipanggil', () => {
    const pino = appLogger.getPino();
    const spy = vi.spyOn(pino, 'info');

    appLogger.log('Pesan info', 'TestContext', { key: 'value' });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'TestContext', key: 'value' }),
      'Pesan info',
    );
  });

  it('harus memanggil pino.error saat appLogger.error() dipanggil', () => {
    const pino = appLogger.getPino();
    const spy = vi.spyOn(pino, 'error');

    appLogger.error('Pesan error', 'StackTrace', 'TestContext', { errCode: 500 });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'TestContext', trace: 'StackTrace', errCode: 500 }),
      'Pesan error',
    );
  });

  it('harus memanggil pino.warn saat appLogger.warn() dipanggil', () => {
    const pino = appLogger.getPino();
    const spy = vi.spyOn(pino, 'warn');

    appLogger.warn('Pesan peringatan', 'TestContext');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'TestContext' }),
      'Pesan peringatan',
    );
  });

  it('harus memanggil pino.debug saat appLogger.debug() dipanggil', () => {
    const pino = appLogger.getPino();
    const spy = vi.spyOn(pino, 'debug');

    appLogger.debug('Pesan debug', 'TestContext');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'TestContext' }),
      'Pesan debug',
    );
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
    const pino = appLogger.getPino();
    const spy = vi.spyOn(pino, 'info');

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
