import { describe, expect, it } from 'vitest';
import { validateSortField, validateSortOrder } from './sort.util';
import { buildPaginatedResult } from './pagination.dto';
import { ValidationError } from '../errors/app-error';

describe('Pagination & SQL Injection Safe Sorting Utility', () => {
  const allowedColumns = ['created_at', 'full_name', 'email', 'updated_at'] as const;

  describe('validateSortField', () => {
    it('mengembalikan kolom yang diminta jika terdaftar dalam whitelist', () => {
      const field = validateSortField('full_name', allowedColumns, 'created_at');
      expect(field).toBe('full_name');
    });

    it('mengembalikan kolom default jika parameter kosong', () => {
      const field = validateSortField(undefined, allowedColumns, 'created_at');
      expect(field).toBe('created_at');
    });

    it('mencegah SQL Injection dan melempar ValidationError jika throwOnError=true', () => {
      const maliciousPayload = 'created_at; DROP TABLE hr.employees;--';

      expect(() =>
        validateSortField(maliciousPayload, allowedColumns, 'created_at', true),
      ).toThrowError(ValidationError);

      expect(() =>
        validateSortField(maliciousPayload, allowedColumns, 'created_at', true),
      ).toThrowError(/Karakter tidak valid/);
    });

    it('mengembalikan default aman jika input tidak terdaftar dan throwOnError=false', () => {
      const field = validateSortField('kolom_rahasia_admin', allowedColumns, 'created_at', false);
      expect(field).toBe('created_at');
    });

    it('melempar ValidationError jika kolom tidak ada di whitelist dan throwOnError=true', () => {
      expect(() =>
        validateSortField('kolom_rahasia_admin', allowedColumns, 'created_at', true),
      ).toThrowError(/tidak diizinkan/);
    });
  });

  describe('validateSortOrder', () => {
    it('menormalkan arah pengurutan ke asc atau desc', () => {
      expect(validateSortOrder('ASC')).toBe('asc');
      expect(validateSortOrder('desc')).toBe('desc');
      expect(validateSortOrder('invalid_order')).toBe('desc');
      expect(validateSortOrder(undefined, 'asc')).toBe('asc');
    });
  });

  describe('buildPaginatedResult', () => {
    it('menghitung metadata paginasi (totalPages, hasNextPage, hasPreviousPage) dengan tepat', () => {
      const result = buildPaginatedResult({
        items: ['a', 'b', 'c'],
        total: 25,
        page: 2,
        limit: 10,
      });

      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(true);
    });
  });
});
