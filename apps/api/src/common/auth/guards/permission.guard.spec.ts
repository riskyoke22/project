import { describe, expect, it, beforeEach } from 'vitest';
import { Controller, Get, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { Public } from '../decorators/public.decorator';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { ForbiddenError, UnauthorizedError } from '../../errors/app-error';

// Controller tiruan untuk pengujian guard
@Controller('test')
class SampleController {
  @Get('public')
  @Public()
  publicEndpoint() {
    return 'public';
  }

  @Get('protected')
  @RequirePermission('hr.employee.read')
  protectedEndpoint() {
    return 'protected';
  }

  @Get('undecorated')
  undecoratedEndpoint() {
    return 'no decorator';
  }
}

describe('PermissionGuard (Deny-by-Default & RBAC)', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;
  let sampleController: SampleController;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionGuard(reflector);
    sampleController = new SampleController();
  });

  function mockContext(
    handlerName: keyof SampleController,
    user?: Record<string, unknown>,
  ): ExecutionContext {
    const handler = sampleController[handlerName];
    const targetClass = SampleController;

    return {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('mengizinkan akses ke endpoint dengan dekorator @Public() tanpa perlu autentikasi', () => {
    const ctx = mockContext('publicEndpoint');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('menolak secara default endpoint TANPA dekorator @Public maupun @RequirePermission (Deny-by-Default)', () => {
    const ctx = mockContext('undecoratedEndpoint');
    try {
      guard.canActivate(ctx);
      expect.fail('Harus melempar ForbiddenError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe('ENDPOINT_DENY_BY_DEFAULT');
    }
  });

  it('menolak akses ke endpoint berizin jika request tidak memiliki user login', () => {
    const ctx = mockContext('protectedEndpoint');
    expect(() => guard.canActivate(ctx)).toThrowError(UnauthorizedError);
  });

  it('menolak akses jika user tidak memiliki izin yang disyaratkan', () => {
    const ctx = mockContext('protectedEndpoint', {
      id: 'usr-1',
      username: 'budi',
      permissions: ['archive.document.read'], // tidak punya hr.employee.read
    });

    expect(() => guard.canActivate(ctx)).toThrowError(ForbiddenError);
    expect(() => guard.canActivate(ctx)).toThrowError(/Hak akses tidak mencukupi/);
  });

  it('mengizinkan akses jika user memiliki izin yang disyaratkan', () => {
    const ctx = mockContext('protectedEndpoint', {
      id: 'usr-1',
      username: 'budi',
      permissions: ['hr.employee.read'],
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('selalu mengizinkan pengguna dengan peran super_admin', () => {
    const ctx = mockContext('protectedEndpoint', {
      id: 'usr-admin',
      username: 'admin',
      roles: ['super_admin'],
      permissions: [],
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
