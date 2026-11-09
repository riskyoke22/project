import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { HealthController } from './common/health/health.controller';
import { HealthService } from './common/health/health.service';
import { AppLogger } from './common/logger/logger.service';
import { RequestLoggerMiddleware } from './common/logger/request-logger.middleware';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [AppLogger, HealthService],
  exports: [AppLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
