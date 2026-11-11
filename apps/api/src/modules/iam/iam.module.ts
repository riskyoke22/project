import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequirePermissionGuard } from './guards/require-permission.guard';
import { MfaService } from './mfa.service';
import { SessionService } from './session.service';
import { UsersModule } from '../../shared/users/users.module'; // assumes shared module for user repo

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES') || '15m' },
      }),
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RequirePermissionGuard, MfaService, SessionService],
  exports: [AuthService, JwtAuthGuard, RequirePermissionGuard],
})
export class IamModule {}
