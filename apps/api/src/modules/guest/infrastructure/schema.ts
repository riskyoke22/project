import { pgSchema, uuid, text, boolean, smallint, date, timestamp } from 'drizzle-orm/pg-core';
import { baseColumns } from '../../../common/database/base-columns';
import { bytea } from '../../../common/database/custom-types';

export const guestSchema = pgSchema('guest');

export const visitors = guestSchema.table('visitors', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: text('full_name').notNull(),
  organization: text('organization'),
  identityType: text('identity_type', {
    enum: ['national_id', 'driver_license', 'passport', 'other'],
  }),
  identityNumberEnc: bytea('identity_number_enc'),
  identityNumberHash: bytea('identity_number_hash'),
  phoneEnc: bytea('phone_enc'),
  emailEnc: bytea('email_enc'),
  photoFileId: uuid('photo_file_id'), // Referensi cross-module ke core.files (hanya ID)
  isBlocked: boolean('is_blocked').default(false).notNull(),
  blockedReason: text('blocked_reason'),
  ...baseColumns,
});

export const appointments = guestSchema.table('appointments', {
  id: uuid('id').defaultRandom().primaryKey(),
  visitorId: uuid('visitor_id').references(() => visitors.id),
  visitorName: text('visitor_name').notNull(),
  hostEmployeeId: uuid('host_employee_id').notNull(), // Referensi cross-module ke hr.employees (hanya ID)
  orgUnitId: uuid('org_unit_id'), // Referensi cross-module ke core.org_units (hanya ID)
  purpose: text('purpose').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: text('status', {
    enum: ['requested', 'approved', 'rejected', 'cancelled', 'arrived', 'expired'],
  })
    .default('requested')
    .notNull(),
  qrTokenHash: bytea('qr_token_hash').unique(),
  qrExpiresAt: timestamp('qr_expires_at', { withTimezone: true }),
  decidedBy: uuid('decided_by'), // Referensi cross-module ke core.users (hanya ID)
  ...baseColumns,
});

export const visits = guestSchema.table('visits', {
  id: uuid('id').defaultRandom().primaryKey(),
  visitorId: uuid('visitor_id')
    .notNull()
    .references(() => visitors.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  hostEmployeeId: uuid('host_employee_id'), // Referensi cross-module ke hr.employees (hanya ID)
  orgUnitId: uuid('org_unit_id'), // Referensi cross-module ke core.org_units (hanya ID)
  purpose: text('purpose').notNull(),
  partySize: smallint('party_size').default(1).notNull(),
  badgeNumber: text('badge_number'),
  checkInAt: timestamp('check_in_at', { withTimezone: true }).defaultNow().notNull(),
  checkOutAt: timestamp('check_out_at', { withTimezone: true }),
  status: text('status', {
    enum: ['checked_in', 'checked_out', 'auto_closed'],
  })
    .default('checked_in')
    .notNull(),
  signatureFileId: uuid('signature_file_id'), // Referensi cross-module ke core.files (hanya ID)
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
  retentionUntil: date('retention_until'),
  checkedInBy: uuid('checked_in_by'), // Referensi cross-module ke core.users (hanya ID)
  ...baseColumns,
});

export const visitCompanions = guestSchema.table('visit_companions', {
  id: uuid('id').defaultRandom().primaryKey(),
  visitId: uuid('visit_id')
    .notNull()
    .references(() => visits.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  organization: text('organization'),
});
