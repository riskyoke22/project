import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';
import { HealthService, HealthCheckResult } from './health.service';
import { Response } from 'express';

describe('HealthController', () => {
  it('GET /ready harus mengembalikan status ready', () => {
    const mockHealthService = {} as HealthService;
    const controller = new HealthController(mockHealthService);

    const result = controller.getReady();
    expect(result.status).toBe('ready');
    expect(result.timestamp).toBeDefined();
  });

  it('GET /health harus mengembalikan status ok dan rincian layanan', async () => {
    const mockResult: HealthCheckResult = {
      status: 'ok',
      services: {
        database: { status: 'up', latencyMs: 2 },
        redis: { status: 'up', latencyMs: 1 },
        minio: { status: 'up', latencyMs: 5 },
      },
      timestamp: new Date().toISOString(),
    };

    const mockHealthService: Partial<HealthService> = {
      checkHealth: vi.fn().mockResolvedValue(mockResult),
    };

    const controller = new HealthController(mockHealthService as HealthService);

    let capturedStatus = 0;
    let capturedBody: unknown = null;

    const mockRes = {
      status: vi.fn((code: number) => {
        capturedStatus = code;
        return {
          json: (body: unknown) => {
            capturedBody = body;
            return body;
          },
        };
      }),
    } as unknown as Response;

    await controller.getHealth(mockRes);

    expect(capturedStatus).toBe(200);
    expect(capturedBody).toEqual(mockResult);
  });
});
