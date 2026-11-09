import { describe, expect, it } from 'vitest';
import { PERMISSIONS, isValidPermission } from './permissions';

describe('Permissions Constants', () => {
  it('should validate valid permissions', () => {
    expect(isValidPermission('iam.user.read')).toBe(true);
    expect(isValidPermission(PERMISSIONS.HR_EMPLOYEE_READ)).toBe(true);
    expect(isValidPermission('invalid.permission')).toBe(false);
  });

  it('should have standard module.resource.action format', () => {
    const permissionValues = Object.values(PERMISSIONS);
    for (const perm of permissionValues) {
      const parts = perm.split('.');
      expect(parts.length).toBeGreaterThanOrEqual(3);
    }
  });
});
