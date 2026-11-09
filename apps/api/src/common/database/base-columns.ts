import { timestamp, uuid, integer } from 'drizzle-orm/pg-core';

/**
 * Kolom dasar standar (core.base_columns) sesuai docs/02-erd.md.
 * Disalin ke semua tabel bisnis untuk audit waktu dan optimistic locking.
 */
export const baseColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  rowVersion: integer('row_version').default(1).notNull(),
};

/**
 * Tipe ID bersama lintas modul (Cross-Module Reference Types).
 * Dilarang mengimpor tabel langsung lintas modul; hanya boleh menggunakan tipe ID.
 */
export type OrgUnitId = string;
export type UserId = string;
export type RoleId = string;
export type PermissionId = string;
export type FileId = string;
export type EmployeeId = string;
export type DocumentId = string;
