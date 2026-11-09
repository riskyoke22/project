import { pgSchema, bigserial, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { inet, bytea } from '../../../common/database/custom-types';

export const auditSchema = pgSchema('audit');

export const auditLogs = auditSchema.table('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  actorUserId: uuid('actor_user_id'),
  actorIp: inet('actor_ip'),
  requestId: text('request_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  beforeData: jsonb('before_data'),
  afterData: jsonb('after_data'),
  prevHash: bytea('prev_hash'),
  rowHash: bytea('row_hash').notNull(),
});
