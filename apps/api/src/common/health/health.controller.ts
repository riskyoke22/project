import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  async getHealth(@Res() res: Response) {
    const health = await this.healthService.checkHealth();
    const httpStatus = health.status === 'down' ? 503 : 200;
    return res.status(httpStatus).json(health);
  }

  @Get('ready')
  getReady() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }
}
