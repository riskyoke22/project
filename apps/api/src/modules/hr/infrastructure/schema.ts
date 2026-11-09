import {
  pgSchema,
  uuid,
  text,
  boolean,
  smallint,
  smallserial,
  date,
  numeric,
  uniqueIndex,
  timestamp,
} from 'drizzle-orm/pg-core';
import { baseColumns } from '../../../common/database/base-columns';
import { citext, bytea } from '../../../common/database/custom-types';

export const hrSchema = pgSchema('hr');

export const employmentStatuses = hrSchema.table('employment_statuses', {
  id: smallserial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
});

export const grades = hrSchema.table('grades', {
  id: smallserial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  rankLevel: smallint('rank_level').notNull(),
});

export const positions = hrSchema.table('positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  positionType: text('position_type', {
    enum: ['structural', 'functional', 'executive'],
  }).notNull(),
  jobLevel: smallint('job_level'),
  isActive: boolean('is_active').default(true).notNull(),
  ...baseColumns,
});

export const employees = hrSchema.table('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').unique(), // Referensi cross-module ke core.users (hanya ID)
  employeeNumber: text('employee_number').notNull().unique(),
  nationalIdEnc: bytea('national_id_enc'),
  nationalIdHash: bytea('national_id_hash').unique(),
  fullName: text('full_name').notNull(),
  frontTitle: text('front_title'),
  backTitle: text('back_title'),
  gender: text('gender', { enum: ['M', 'F'] }),
  birthPlace: text('birth_place'),
  birthDate: date('birth_date'),
  religion: text('religion'),
  maritalStatus: text('marital_status'),
  workEmail: citext('work_email').unique(),
  phoneEnc: bytea('phone_enc'),
  residenceAddress: text('residence_address'),
  employmentStatusId: smallint('employment_status_id').references(() => employmentStatuses.id),
  hireDate: date('hire_date'),
  terminationDate: date('termination_date'),
  terminationReason: text('termination_reason'),
  photoFileId: uuid('photo_file_id'), // Referensi cross-module ke core.files (hanya ID)
  ...baseColumns,
});

export const employeeAssignments = hrSchema.table('employee_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id),
  orgUnitId: uuid('org_unit_id').notNull(), // Referensi cross-module ke core.org_units (hanya ID)
  positionId: uuid('position_id').references(() => positions.id),
  gradeId: smallint('grade_id').references(() => grades.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  isPrimary: boolean('is_primary').default(true).notNull(),
  decreeNumber: text('decree_number'),
  decreeDocumentId: uuid('decree_document_id'), // Referensi cross-module ke archive.documents (hanya ID)
  notes: text('notes'),
  ...baseColumns,
});

export const employeeFamilies = hrSchema.table('employee_families', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id),
  relationship: text('relationship', {
    enum: ['spouse', 'child', 'parent', 'sibling', 'other'],
  }).notNull(),
  fullName: text('full_name').notNull(),
  birthDate: date('birth_date'),
  nationalIdEnc: bytea('national_id_enc'),
  isDependent: boolean('is_dependent').default(false).notNull(),
  ...baseColumns,
});

export const employeeEducations = hrSchema.table('employee_educations', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id),
  level: text('level').notNull(),
  institution: text('institution').notNull(),
  major: text('major'),
  graduationYear: smallint('graduation_year'),
  certificateFileId: uuid('certificate_file_id'), // Referensi cross-module ke core.files (hanya ID)
  ...baseColumns,
});

export const leaveTypes = hrSchema.table('leave_types', {
  id: smallserial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  annualQuotaDays: numeric('annual_quota_days', { precision: 4, scale: 1 }),
  requiresAttachment: boolean('requires_attachment').default(false).notNull(),
  isPaid: boolean('is_paid').default(true).notNull(),
});

export const leaveBalances = hrSchema.table(
  'leave_balances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    leaveTypeId: smallint('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id),
    year: smallint('year').notNull(),
    entitledDays: numeric('entitled_days', { precision: 4, scale: 1 }).default('0').notNull(),
    carriedOverDays: numeric('carried_over_days', { precision: 4, scale: 1 })
      .default('0')
      .notNull(),
    usedDays: numeric('used_days', { precision: 4, scale: 1 }).default('0').notNull(),
    ...baseColumns,
  },
  (table) => ({
    uniqueEmpLeaveYear: uniqueIndex('leave_balances_emp_type_year_unique').on(
      table.employeeId,
      table.leaveTypeId,
      table.year,
    ),
  }),
);

export const leaveRequests = hrSchema.table('leave_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id),
  leaveTypeId: smallint('leave_type_id')
    .notNull()
    .references(() => leaveTypes.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  totalDays: numeric('total_days', { precision: 4, scale: 1 }).notNull(),
  reason: text('reason'),
  status: text('status', {
    enum: ['draft', 'submitted', 'approved', 'rejected', 'cancelled'],
  })
    .default('submitted')
    .notNull(),
  approverId: uuid('approver_id').references(() => employees.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decisionNote: text('decision_note'),
  attachmentFileId: uuid('attachment_file_id'), // Referensi cross-module ke core.files (hanya ID)
  ...baseColumns,
});
