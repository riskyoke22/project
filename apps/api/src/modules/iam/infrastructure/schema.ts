import {
  pgSchema,
  uuid,
  text,
  boolean,
  smallint,
  integer,
  timestamp,
  date,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { baseColumns } from '../../../common/database/base-columns';
import { citext, ltree, inet, bytea } from '../../../common/database/custom-types';

export const coreSchema = pgSchema('core');

export const orgUnits = coreSchema.table('org_units', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id'),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  unitType: text('unit_type').notNull(),
  path: ltree('path').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  ...baseColumns,
});

export const users = coreSchema.table('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: citext('username').notNull().unique(),
  email: citext('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  status: text('status', { enum: ['active', 'suspended', 'locked', 'disabled'] })
    .default('active')
    .notNull(),
  mustChangePassword: boolean('must_change_password').default(true).notNull(),
  failedAttempts: smallint('failed_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  ...baseColumns,
});

export const roles = coreSchema.table('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(false).notNull(),
  ...baseColumns,
});

export const permissions = coreSchema.table('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  module: text('module').notNull(),
  description: text('description'),
});

export const rolePermissions = coreSchema.table(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
  }),
);

export const userRoles = coreSchema.table(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    orgUnitId: uuid('org_unit_id').references(() => orgUnits.id),
    validFrom: date('valid_from').defaultNow().notNull(),
    validTo: date('valid_to'),
    grantedBy: uuid('granted_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueActive: uniqueIndex('user_roles_unique_active').on(
      table.userId,
      table.roleId,
      table.orgUnitId,
      table.validFrom,
    ),
  }),
);

export const authSessions = coreSchema.table('auth_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  familyId: uuid('family_id').notNull(),
  refreshTokenHash: bytea('refresh_token_hash').notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: inet('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  rotatedAt: timestamp('rotated_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedReason: text('revoked_reason'),
});

export const mfaFactors = coreSchema.table('mfa_factors', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  factorType: text('factor_type', { enum: ['totp', 'webauthn', 'recovery_code'] }).notNull(),
  secretEnc: bytea('secret_enc').notNull(),
  label: text('label'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const numberSequences = coreSchema.table(
  'number_sequences',
  {
    scope: text('scope').notNull(),
    year: integer('year').notNull(),
    lastValue: integer('last_value').default(0).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.scope, table.year] }),
  }),
);

export const notifications = coreSchema.table('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  refType: text('ref_type'),
  refId: uuid('ref_id'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
