import { pgSchema, uuid, text, bigint, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { bytea } from '../../../common/database/custom-types';

export const coreSchema = pgSchema('core');

export const files = coreSchema.table(
  'files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storageBucket: text('storage_bucket').notNull(),
    storageKey: text('storage_key').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
    sha256: bytea('sha256').notNull(),
    scanStatus: text('scan_status', { enum: ['pending', 'clean', 'infected', 'failed'] })
      .default('pending')
      .notNull(),
    uploadedBy: uuid('uploaded_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    uniqueStorage: uniqueIndex('files_storage_unique').on(table.storageBucket, table.storageKey),
  }),
);
