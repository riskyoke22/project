import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { HealthController } from './common/health/health.controller';
import { HealthService } from './common/health/health.service';

@Module({
  imports: [CommonModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
