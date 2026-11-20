import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { HealthController } from './common/health/health.controller';
import { HealthService } from './common/health/health.service';
import { GuestModule } from './modules/guest/guest.module';

@Module({
  imports: [CommonModule, GuestModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
