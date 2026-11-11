import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../auth.constants';
import { ForbiddenError, UnauthorizedError } from '../../errors/app-error';

export interface AuthenticatedUser {
  id: string;
  username: string;
  roles?: string[];
  permissions?: string[];
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Cek apakah handler atau kelas controller memiliki dekorator @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Cek apakah handler atau kelas memiliki dekorator @RequirePermission()
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 3. PRINSIP DENY-BY-DEFAULT:
    // Jika endpoint TIDAK bertanda @Public dan TIDAK bertanda @RequirePermission,
    // maka endpoint ditolak secara otomatis (harus gagal pada tes).
    if (!requiredPermissions) {
      throw new ForbiddenError(
        'Akses ditolak: Endpoint ini tidak memiliki dekorator izin (@RequirePermission atau @Public). Prinsip Deny-by-Default aktif.',
        'ENDPOINT_DENY_BY_DEFAULT',
      );
    }

    // 4. Verifikasi pengguna & izin
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new UnauthorizedError('Autentikasi diperlukan untuk mengakses sumber daya ini.');
    }

    // Super admin selalu diizinkan untuk semua endpoint
    if (user.roles?.includes('super_admin')) {
      return true;
    }

    const userPermissions = new Set(user.permissions || []);
    const hasAllPermissions = requiredPermissions.every((perm) => userPermissions.has(perm));

    if (!hasAllPermissions) {
      throw new ForbiddenError(
        'Hak akses tidak mencukupi untuk melakukan tindakan ini.',
        'INSUFFICIENT_PERMISSIONS',
        { required: requiredPermissions },
      );
    }

    return true;
  }
}
