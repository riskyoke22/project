/**
 * Aksi-aksi yang didukung dalam pencatatan jejak audit (audit trail).
 * Sesuai panduan arsitektur dan spesifikasi keamanan organisasi.
 */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'export'
  | 'view_sensitive'
  | 'permission_change'
  | 'dispose';

export interface CreateAuditLogDto {
  actorUserId?: string | null;
  actorIp?: string | null;
  requestId?: string | null;
  action: AuditAction;
  entity: string; // e.g. 'hr.employees', 'iam.users', 'archive.documents'
  entityId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  occurredAt?: Date;
}

export interface AuditLogRecord {
  id: string | number;
  occurred_at: string | Date;
  actor_user_id: string | null;
  actor_ip?: string | null;
  request_id?: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  prev_hash: Buffer | string | null;
  row_hash: Buffer | string;
}

export interface AuditVerificationResult {
  isValid: boolean;
  totalVerified: number;
  tamperedRecords: Array<{
    id: string | number;
    reason: 'PREV_HASH_MISMATCH' | 'ROW_HASH_MISMATCH' | 'INVALID_HASH_STRUCTURE';
    expectedHash?: string;
    actualHash?: string;
  }>;
}
