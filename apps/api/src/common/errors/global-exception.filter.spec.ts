import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { BusinessRuleError, NotFoundError } from './app-error';
import { AppLogger } from '../logger/logger.service';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockLogger: AppLogger;

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      getPino: vi.fn(),
    } as unknown as AppLogger;

    filter = new GlobalExceptionFilter(mockLogger);
  });

  function createMockHost(headers: Record<string, string> = {}) {
    const jsonFn = vi.fn();
    const statusFn = vi.fn().mockReturnValue({ json: jsonFn });

    const mockResponse = {
      status: statusFn,
      json: jsonFn,
    };

    const mockRequest = {
      headers: {
        'x-request-id': 'req-test-12345',
        ...headers,
      },
      url: '/api/v1/resource',
      method: 'POST',
    };

    const host = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    return { host, statusFn, jsonFn };
  }

  it('mengembalikan format standar untuk domain error (AppError / NotFoundError)', () => {
    const { host, statusFn, jsonFn } = createMockHost();
    const error = new NotFoundError(
      'Pegawai dengan ID tersebut tidak ditemukan',
      'EMPLOYEE_NOT_FOUND',
    );

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(404);
    expect(jsonFn).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Pegawai dengan ID tersebut tidak ditemukan',
        requestId: 'req-test-12345',
      },
    });
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('mengembalikan status dan kode untuk BusinessRuleError spesifik modul', () => {
    const { host, statusFn, jsonFn } = createMockHost();
    const error = new BusinessRuleError(
      'Sisa cuti tahunan tidak mencukupi untuk pengajuan ini',
      'LEAVE_BALANCE_INSUFFICIENT',
      { remainingBalance: 2, requestedDays: 5 },
    );

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'LEAVE_BALANCE_INSUFFICIENT',
        message: 'Sisa cuti tahunan tidak mencukupi untuk pengajuan ini',
        requestId: 'req-test-12345',
        details: { remainingBalance: 2, requestedDays: 5 },
      },
    });
  });

  it('mengembalikan respons yang aman untuk HttpException standar NestJS', () => {
    const { host, statusFn, jsonFn } = createMockHost();
    const error = new HttpException('Bad Request Body', HttpStatus.BAD_REQUEST);

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'HTTP_400',
          message: 'Bad Request Body',
          requestId: 'req-test-12345',
        }),
      }),
    );
  });

  it('merahasiakan detail teknis/SQL pada unhandled internal exception dan mencatatnya ke log', () => {
    const { host, statusFn, jsonFn } = createMockHost();
    const error = new Error('FATAL: relation "secret_db_table" does not exist at syntax line 1');

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(500);
    const sentResponse = jsonFn.mock.calls[0][0];

    expect(sentResponse.success).toBe(false);
    expect(sentResponse.error.code).toBe('INTERNAL_SERVER_ERROR');
    // Pesan ke klien HARUS pesan umum, TIDAK boleh membocorkan nama tabel SQL!
    expect(sentResponse.error.message).toContain('Terjadi kesalahan internal');
    expect(sentResponse.error.message).not.toContain('secret_db_table');
    expect(sentResponse.error.requestId).toBe('req-test-12345');

    // Pesan error asli dicatat ke logger server
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('secret_db_table'),
      expect.any(String),
      'GlobalExceptionFilter',
      expect.objectContaining({ requestId: 'req-test-12345' }),
    );
  });
});
