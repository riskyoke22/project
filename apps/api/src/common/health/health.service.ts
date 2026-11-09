import { Injectable } from '@nestjs/common';
import * as net from 'net';
import * as http from 'http';
import { getEnv } from '../config/env.config';

export interface ServiceHealth {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    minio: ServiceHealth;
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  async checkHealth(): Promise<HealthCheckResult> {
    const env = getEnv();

    const [dbHealth, redisHealth, minioHealth] = await Promise.all([
      this.checkDatabase(env.DATABASE_URL),
      this.checkRedis(env.REDIS_URL),
      this.checkMinio(env.MINIO_ENDPOINT, env.MINIO_PORT),
    ]);

    const isAllUp =
      dbHealth.status === 'up' && redisHealth.status === 'up' && minioHealth.status === 'up';
    const isAllDown =
      dbHealth.status === 'down' && redisHealth.status === 'down' && minioHealth.status === 'down';

    const overallStatus: HealthCheckResult['status'] = isAllUp
      ? 'ok'
      : isAllDown
        ? 'down'
        : 'degraded';

    return {
      status: overallStatus,
      services: {
        database: dbHealth,
        redis: redisHealth,
        minio: minioHealth,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkTcp(host: string, port: number, timeoutMs = 1500): Promise<ServiceHealth> {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        const latencyMs = Date.now() - startTime;
        socket.destroy();
        resolve({ status: 'up', latencyMs });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ status: 'down', message: 'Connection timeout' });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ status: 'down', message: err.message });
      });

      socket.connect(port, host);
    });
  }

  private async checkDatabase(databaseUrl: string): Promise<ServiceHealth> {
    try {
      const url = new URL(databaseUrl);
      const host = url.hostname || '127.0.0.1';
      const port = Number(url.port) || 5432;
      return await this.checkTcp(host, port);
    } catch (err) {
      return { status: 'down', message: `Invalid DATABASE_URL: ${(err as Error).message}` };
    }
  }

  private async checkRedis(redisUrl: string): Promise<ServiceHealth> {
    try {
      const url = new URL(redisUrl);
      const host = url.hostname || '127.0.0.1';
      const port = Number(url.port) || 6379;
      return await this.checkTcp(host, port);
    } catch (err) {
      return { status: 'down', message: `Invalid REDIS_URL: ${(err as Error).message}` };
    }
  }

  private async checkMinio(host: string, port: number): Promise<ServiceHealth> {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const req = http.get(
        {
          host,
          port,
          path: '/minio/health/live',
          timeout: 1500,
        },
        (res) => {
          const latencyMs = Date.now() - startTime;
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
            resolve({ status: 'up', latencyMs });
          } else {
            resolve({ status: 'down', message: `HTTP status ${res.statusCode}` });
          }
        },
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'down', message: 'MinIO ping timeout' });
      });

      req.on('error', (err) => {
        resolve({ status: 'down', message: err.message });
      });
    });
  }
}
