import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { HealthController } from '../health/health.controller';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './auth.constants';

describe('Route Security Scanner (Deny-by-Default Audit)', () => {
  const reflector = new Reflector();

  // Daftar seluruh controller yang ada di aplikasi saat ini
  const controllersToScan = [HealthController];

  it('memastikan setiap controller dan setiap route handler memiliki dekorator @Public atau @RequirePermission', () => {
    const uninspectedOrMissingRoutes: string[] = [];

    for (const ControllerClass of controllersToScan) {
      const isClassPublic = reflector.get<boolean>(IS_PUBLIC_KEY, ControllerClass);
      const classPermissions = reflector.get<string[]>(PERMISSIONS_KEY, ControllerClass);

      // Jika controller pada tingkat kelas sudah @Public atau @RequirePermission, seluruh metodenya terlindungi
      if (isClassPublic || (classPermissions && classPermissions.length > 0)) {
        continue;
      }

      const prototype = ControllerClass.prototype;
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (name) => name !== 'constructor' && typeof prototype[name] === 'function',
      );

      for (const methodName of methodNames) {
        const handler = prototype[methodName];
        const isHandlerPublic = reflector.get<boolean>(IS_PUBLIC_KEY, handler);
        const handlerPermissions = reflector.get<string[]>(PERMISSIONS_KEY, handler);

        const hasSecurityDecorator =
          isHandlerPublic === true ||
          (Array.isArray(handlerPermissions) && handlerPermissions.length > 0);

        if (!hasSecurityDecorator) {
          uninspectedOrMissingRoutes.push(`${ControllerClass.name}.${methodName}`);
        }
      }
    }

    expect(
      uninspectedOrMissingRoutes,
      `Ditemukan endpoint tanpa dekorator otorisasi (@Public atau @RequirePermission):\n${uninspectedOrMissingRoutes.join(
        '\n',
      )}`,
    ).toEqual([]);
  });
});
