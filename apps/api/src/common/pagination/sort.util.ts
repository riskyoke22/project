import { ValidationError } from '../errors/app-error';

export type SortOrder = 'asc' | 'desc';

/**
 * Utilitas validasi pengurutan yang aman dari SQL Injection.
 * Kolom yang diminta WAJIB terdaftar dalam daftar putih (whitelist).
 * Jika ada input berbahaya, SQL syntax, atau kolom yang tidak terdaftar,
 * fungsi akan melempar ValidationError atau menggunakan fallback aman.
 */
export function validateSortField<T extends string>(
  requestedField: string | undefined,
  allowedFields: readonly T[],
  defaultField: T,
  throwOnError: boolean = false,
): T {
  if (!requestedField) {
    return defaultField;
  }

  // Sanitasi karakter: nama kolom hanya boleh alphanumeric dan underscore
  if (!/^[a-zA-Z0-9_]+$/.test(requestedField)) {
    if (throwOnError) {
      throw new ValidationError(
        `Karakter tidak valid pada parameter pengurutan: '${requestedField}'`,
        'INVALID_SORT_CHARACTERS',
      );
    }
    return defaultField;
  }

  if (allowedFields.includes(requestedField as T)) {
    return requestedField as T;
  }

  if (throwOnError) {
    throw new ValidationError(
      `Kolom pengurutan '${requestedField}' tidak diizinkan. Kolom yang diperbolehkan: ${allowedFields.join(', ')}`,
      'INVALID_SORT_FIELD',
    );
  }

  return defaultField;
}

export function validateSortOrder(
  order: string | undefined,
  defaultOrder: SortOrder = 'desc',
): SortOrder {
  if (!order) return defaultOrder;
  const normalized = order.toLowerCase();
  return normalized === 'asc' ? 'asc' : 'desc';
}
