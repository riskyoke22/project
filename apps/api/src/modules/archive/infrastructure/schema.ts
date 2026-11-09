import {
  pgSchema,
  uuid,
  text,
  smallint,
  integer,
  date,
  timestamp,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { baseColumns } from '../../../common/database/base-columns';
import { citext, tsvector } from '../../../common/database/custom-types';

export const archiveSchema = pgSchema('archive');

export const categories = archiveSchema.table('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id'),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  activeRetentionYears: smallint('active_retention_years').default(0).notNull(),
  inactiveRetentionYears: smallint('inactive_retention_years').default(0).notNull(),
  finalDisposition: text('final_disposition', {
    enum: ['destroy', 'permanent', 'review'],
  })
    .default('review')
    .notNull(),
  ...baseColumns,
});

export const physicalLocations = archiveSchema.table(
  'physical_locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    building: text('building'),
    room: text('room'),
    rack: text('rack'),
    box: text('box'),
  },
  (table) => ({
    uniqueLocation: uniqueIndex('physical_locations_unique').on(
      table.building,
      table.room,
      table.rack,
      table.box,
    ),
  }),
);

export const documents = archiveSchema.table(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentNumber: text('document_number'),
    agendaNumber: text('agenda_number'),
    docType: text('doc_type', {
      enum: ['incoming_letter', 'outgoing_letter', 'memo', 'decree', 'other'],
    }).notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    documentDate: date('document_date'),
    receivedDate: date('received_date'),
    counterparty: text('counterparty'),
    ownerOrgUnitId: uuid('owner_org_unit_id').notNull(), // Referensi cross-module ke core.org_units (hanya ID)
    categoryId: uuid('category_id').references(() => categories.id),
    securityLevel: text('security_level', {
      enum: ['public', 'internal', 'restricted', 'confidential'],
    })
      .default('internal')
      .notNull(),
    lifecycleStatus: text('lifecycle_status', {
      enum: ['active', 'inactive', 'permanent', 'destroyed'],
    })
      .default('active')
      .notNull(),
    retentionUntil: date('retention_until'),
    currentVersionId: uuid('current_version_id'),
    physicalLocationId: uuid('physical_location_id').references(() => physicalLocations.id),
    searchVector: tsvector('search_vector'),
    ...baseColumns,
  },
  (table) => ({
    uniqueDocNumber: uniqueIndex('documents_number_unique').on(table.documentNumber),
  }),
);

export const documentVersions = archiveSchema.table(
  'document_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    versionNo: integer('version_no').notNull(),
    fileId: uuid('file_id').notNull(), // Referensi cross-module ke core.files (hanya ID)
    changeNote: text('change_note'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueDocVersion: uniqueIndex('document_versions_doc_ver_unique').on(
      table.documentId,
      table.versionNo,
    ),
  }),
);

export const documentAcl = archiveSchema.table(
  'document_acl',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    subjectType: text('subject_type', { enum: ['user', 'role', 'org_unit'] }).notNull(),
    subjectId: uuid('subject_id').notNull(),
    permission: text('permission', { enum: ['view', 'edit', 'manage'] }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    grantedBy: uuid('granted_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueAcl: uniqueIndex('document_acl_unique').on(
      table.documentId,
      table.subjectType,
      table.subjectId,
      table.permission,
    ),
  }),
);

export const documentDispositions = archiveSchema.table('document_dispositions', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id),
  fromUserId: uuid('from_user_id').notNull(), // Referensi cross-module ke core.users (hanya ID)
  toUserId: uuid('to_user_id').notNull(), // Referensi cross-module ke core.users (hanya ID)
  instruction: text('instruction').notNull(),
  dueDate: date('due_date'),
  status: text('status', { enum: ['sent', 'read', 'done', 'cancelled'] })
    .default('sent')
    .notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  doneAt: timestamp('done_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const documentLinks = archiveSchema.table(
  'document_links',
  {
    fromDocumentId: uuid('from_document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    toDocumentId: uuid('to_document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    relation: text('relation', {
      enum: ['reply_to', 'attachment_of', 'supersedes', 'related'],
    }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.fromDocumentId, table.toDocumentId, table.relation] }),
  }),
);

export const documentTags = archiveSchema.table(
  'document_tags',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    tag: citext('tag').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.documentId, table.tag] }),
  }),
);

export const disposalRecords = archiveSchema.table('disposal_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  recordNumber: text('record_number').notNull().unique(),
  recordDate: date('record_date').notNull(),
  disposalType: text('disposal_type', { enum: ['destroy', 'transfer_permanent'] }).notNull(),
  approvedBy: uuid('approved_by'), // Referensi cross-module ke core.users (hanya ID)
  recordDocumentId: uuid('record_document_id').references(() => documents.id),
  notes: text('notes'),
  ...baseColumns,
});

export const disposalItems = archiveSchema.table(
  'disposal_items',
  {
    disposalRecordId: uuid('disposal_record_id')
      .notNull()
      .references(() => disposalRecords.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.disposalRecordId, table.documentId] }),
  }),
);
