import {
  pgSchema,
  uuid,
  text,
  boolean,
  smallint,
  smallserial,
  date,
  numeric,
  timestamp,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { baseColumns } from '../../../common/database/base-columns';

export const perfSchema = pgSchema('perf');

export const cycles = perfSchema.table('cycles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  year: smallint('year').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: text('status', { enum: ['draft', 'open', 'closed'] })
    .default('draft')
    .notNull(),
  ...baseColumns,
});

export const goals = perfSchema.table('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  cycleId: uuid('cycle_id')
    .notNull()
    .references(() => cycles.id),
  employeeId: uuid('employee_id').notNull(), // Referensi cross-module ke hr.employees (hanya ID)
  parentGoalId: uuid('parent_goal_id'),
  title: text('title').notNull(),
  description: text('description'),
  indicator: text('indicator'),
  unit: text('unit'),
  targetValue: numeric('target_value', { precision: 14, scale: 2 }),
  weight: numeric('weight', { precision: 5, scale: 2 }).notNull(),
  status: text('status', { enum: ['draft', 'submitted', 'agreed', 'closed'] })
    .default('draft')
    .notNull(),
  ...baseColumns,
});

export const goalProgress = perfSchema.table('goal_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  goalId: uuid('goal_id')
    .notNull()
    .references(() => goals.id),
  progressDate: date('progress_date').notNull(),
  actualValue: numeric('actual_value', { precision: 14, scale: 2 }).notNull(),
  note: text('note'),
  evidenceDocumentId: uuid('evidence_document_id'), // Referensi cross-module ke archive.documents (hanya ID)
  ...baseColumns,
});

export const behaviorAspects = perfSchema.table('behavior_aspects', {
  id: smallserial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  weight: numeric('weight', { precision: 5, scale: 2 }).default('0').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const appraisals = perfSchema.table(
  'appraisals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cycleId: uuid('cycle_id')
      .notNull()
      .references(() => cycles.id),
    employeeId: uuid('employee_id').notNull(), // Referensi cross-module ke hr.employees (hanya ID)
    appraiserId: uuid('appraiser_id').notNull(), // Referensi cross-module ke hr.employees (hanya ID)
    status: text('status', {
      enum: ['draft', 'self_assessed', 'appraised', 'finalized', 'objected'],
    })
      .default('draft')
      .notNull(),
    goalScore: numeric('goal_score', { precision: 6, scale: 2 }),
    behaviorScore: numeric('behavior_score', { precision: 6, scale: 2 }),
    finalScore: numeric('final_score', { precision: 6, scale: 2 }),
    rating: text('rating'),
    comment: text('comment'),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    ...baseColumns,
  },
  (table) => ({
    uniqueCycleEmp: uniqueIndex('appraisals_cycle_emp_unique').on(table.cycleId, table.employeeId),
  }),
);

export const appraisalGoalScores = perfSchema.table(
  'appraisal_goal_scores',
  {
    appraisalId: uuid('appraisal_id')
      .notNull()
      .references(() => appraisals.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id),
    actualValue: numeric('actual_value', { precision: 14, scale: 2 }),
    score: numeric('score', { precision: 6, scale: 2 }),
    weight: numeric('weight', { precision: 5, scale: 2 }).notNull(),
    note: text('note'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.appraisalId, table.goalId] }),
  }),
);

export const appraisalBehaviorScores = perfSchema.table(
  'appraisal_behavior_scores',
  {
    appraisalId: uuid('appraisal_id')
      .notNull()
      .references(() => appraisals.id, { onDelete: 'cascade' }),
    aspectId: smallint('aspect_id')
      .notNull()
      .references(() => behaviorAspects.id),
    score: numeric('score', { precision: 6, scale: 2 }).notNull(),
    note: text('note'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.appraisalId, table.aspectId] }),
  }),
);

export const appraisalReviews = perfSchema.table('appraisal_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  appraisalId: uuid('appraisal_id')
    .notNull()
    .references(() => appraisals.id, { onDelete: 'cascade' }),
  reviewerId: uuid('reviewer_id').notNull(), // Referensi cross-module ke hr.employees (hanya ID)
  action: text('action', {
    enum: ['submit', 'approve', 'return', 'finalize', 'object'],
  }).notNull(),
  comment: text('comment'),
  actedAt: timestamp('acted_at', { withTimezone: true }).defaultNow().notNull(),
});
