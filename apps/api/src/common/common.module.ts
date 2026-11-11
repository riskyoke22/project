import { Global, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { CryptoModule } from './crypto/crypto.module';
import { AppLogger } from './logger/logger.service';
import { RequestLoggerMiddleware } from './logger/request-logger.middleware';
import { AuditService } from './audit/audit.service';
import { AuditInterceptor } from './audit/audit.interceptor';
import { PermissionGuard } from './auth/guards/permission.guard';
import { RateLimiterGuard } from './security/rate-limiter.guard';
import { CsrfMiddleware } from './security/csrf.middleware';
import { GlobalExceptionFilter } from './errors/global-exception.filter';
import { TransactionManager } from './database/transaction';

@Global()
@Module({
  imports: [ConfigModule, CryptoModule],
  providers: [
    AppLogger,
    AuditService,
    AuditInterceptor,
    TransactionManager,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
  ],
  exports: [
    ConfigModule,
    CryptoModule,
    AppLogger,
    AuditService,
    AuditInterceptor,
    TransactionManager,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware, CsrfMiddleware).forRoutes('*');
  }
}
