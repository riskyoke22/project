import { describe, expect, it } from 'vitest';
import { verifySchemaSnapshot } from '../../../../../scripts/verify-schema-snapshot';
import { PERMISSION_SEEDS } from '../../../../../db/seeds/permissions.seed';
import { ROLE_SEEDS } from '../../../../../db/seeds/roles.seed';
import { REFERENCE_DATA_SEEDS } from '../../../../../db/seeds/reference_data.seed';
import { isValidPermission, PERMISSIONS } from '@sistem-terintegrasi/shared';

// Import skema Drizzle tiap modul
import * as iamSchema from '../../modules/iam/infrastructure/schema';
import * as hrSchema from '../../modules/hr/infrastructure/schema';
import * as perfSchema from '../../modules/perf/infrastructure/schema';
import * as archiveSchema from '../../modules/archive/infrastructure/schema';
import * as guestSchema from '../../modules/guest/infrastructure/schema';
import * as filesSchema from '../../modules/files/infrastructure/schema';
import * as auditSchema from '../../modules/audit/infrastructure/schema';

describe('Database Schema & Seed Verification', () => {
  it('berkas migrasi 0001-0008 harus setara 100% dengan acuan db/schema.sql', () => {
    const result = verifySchemaSnapshot();
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  describe('Permissions Seed Integrity', () => {
    it('seluruh izin seed harus memiliki format <modul>.<resource>.<aksi>', () => {
      const permissionPattern = /^[a-z_]+\.[a-z_]+\.[a-z_]+$/;

      for (const perm of PERMISSION_SEEDS) {
        expect(perm.code).toMatch(permissionPattern);
        expect(perm.module).toBeDefined();
        expect(perm.description).toBeDefined();
      }
    });

    it('setiap izin seed harus valid menurut konstanta shared PERMISSIONS', () => {
      const sharedPermValues = Object.values(PERMISSIONS);
      for (const perm of PERMISSION_SEEDS) {
        expect(isValidPermission(perm.code)).toBe(true);
      }
      expect(PERMISSION_SEEDS.length).toBe(sharedPermValues.length);
    });
  });

  describe('Roles Seed Integrity', () => {
    it('seluruh peran bawaan harus terdefinisi dengan benar', () => {
      const expectedRoles = [
        'super_admin',
        'hr_admin',
        'supervisor',
        'employee',
        'archivist',
        'receptionist',
        'auditor',
      ];

      const roleCodes = ROLE_SEEDS.map((r) => r.code);
      for (const expected of expectedRoles) {
        expect(roleCodes).toContain(expected);
      }
    });

    it('seluruh permission_codes pada peran harus merujuk ke izin yang valid', () => {
      for (const role of ROLE_SEEDS) {
        for (const permCode of role.permissionCodes) {
          expect(isValidPermission(permCode)).toBe(true);
        }
      }
    });

    it('super_admin harus memiliki seluruh izin sistem', () => {
      const superAdmin = ROLE_SEEDS.find((r) => r.code === 'super_admin');
      expect(superAdmin).toBeDefined();
      expect(superAdmin?.permissionCodes.length).toBe(Object.values(PERMISSIONS).length);
    });
  });

  describe('Reference Data Seed Integrity', () => {
    it('data referensi awal harus ditandai jelas sebagai contoh organisasi', () => {
      for (const status of REFERENCE_DATA_SEEDS.employmentStatuses) {
        expect(status.name).toContain('contoh, ganti sesuai kebijakan organisasi');
      }
      for (const grade of REFERENCE_DATA_SEEDS.grades) {
        expect(grade.name).toContain('contoh, ganti sesuai kebijakan organisasi');
      }
      for (const leaveType of REFERENCE_DATA_SEEDS.leaveTypes) {
        expect(leaveType.name).toContain('contoh, ganti sesuai kebijakan organisasi');
      }
      for (const aspect of REFERENCE_DATA_SEEDS.behaviorAspects) {
        expect(aspect.name).toContain('contoh, ganti sesuai kebijakan organisasi');
      }
      for (const category of REFERENCE_DATA_SEEDS.archiveCategories) {
        expect(category.name).toContain('contoh, ganti sesuai kebijakan organisasi');
      }
    });

    it('bobot aspek perilaku awal harus berjumlah 100%', () => {
      const totalWeight = REFERENCE_DATA_SEEDS.behaviorAspects.reduce(
        (sum, item) => sum + item.weight,
        0,
      );
      expect(totalWeight).toBe(100);
    });
  });

  describe('Drizzle Schema Declarations per Module', () => {
    it('IAM module harus mengekspor tabel skema core yang valid', () => {
      expect(iamSchema.users).toBeDefined();
      expect(iamSchema.roles).toBeDefined();
      expect(iamSchema.permissions).toBeDefined();
      expect(iamSchema.orgUnits).toBeDefined();
      expect(iamSchema.authSessions).toBeDefined();
    });

    it('HR module harus mengekspor tabel skema hr yang valid', () => {
      expect(hrSchema.employees).toBeDefined();
      expect(hrSchema.employeeAssignments).toBeDefined();
      expect(hrSchema.positions).toBeDefined();
      expect(hrSchema.grades).toBeDefined();
      expect(hrSchema.leaveRequests).toBeDefined();
    });

    it('PERF module harus mengekspor tabel skema perf yang valid', () => {
      expect(perfSchema.cycles).toBeDefined();
      expect(perfSchema.goals).toBeDefined();
      expect(perfSchema.appraisals).toBeDefined();
      expect(perfSchema.behaviorAspects).toBeDefined();
    });

    it('ARCHIVE module harus mengekspor tabel skema archive yang valid', () => {
      expect(archiveSchema.documents).toBeDefined();
      expect(archiveSchema.documentVersions).toBeDefined();
      expect(archiveSchema.categories).toBeDefined();
      expect(archiveSchema.documentDispositions).toBeDefined();
    });

    it('GUEST module harus mengekspor tabel skema guest yang valid', () => {
      expect(guestSchema.visitors).toBeDefined();
      expect(guestSchema.appointments).toBeDefined();
      expect(guestSchema.visits).toBeDefined();
      expect(guestSchema.visitCompanions).toBeDefined();
    });

    it('FILES module harus mengekspor tabel files yang valid', () => {
      expect(filesSchema.files).toBeDefined();
    });

    it('AUDIT module harus mengekspor tabel audit_logs yang valid', () => {
      expect(auditSchema.auditLogs).toBeDefined();
    });
  });
});
