import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../auth.constants';

/**
 * Dekorator otorisasi berbasis izin (RBAC).
 * Mengharuskan pengguna memiliki minimal satu (atau seluruh) kode izin yang tertera.
 * Contoh: `@RequirePermission(PERMISSIONS.HR_EMPLOYEE_READ)`
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
