import { Injectable, Optional } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { Client } from 'pg';
import { AuditLogRecord, AuditVerificationResult, CreateAuditLogDto } from './audit.types';
import { AppLogger } from '../logger/logger.service';

const SENSITIVE_KEY_PATTERN =
  /password|token|secret|cookie|authorization|nik|national_id|mfa|totp|_enc$/i;

@Injectable()
export class AuditService {
  constructor(@Optional() private readonly logger?: AppLogger) {}

  /**
   * Melakukan masking rekursif terhadap data sebelum disimpan ke audit_logs.
   * Field sensitif (password, NIK, token, *_enc) disensor menjadi '[REDACTED]'.
   */
  public maskSensitive<T>(data: T): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitive(item)) as unknown as T;
    }

    if (typeof data === 'object') {
      const maskedObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          maskedObj[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          maskedObj[key] = this.maskSensitive(value);
        } else {
          maskedObj[key] = value;
        }
      }
      return maskedObj as T;
    }

    return data;
  }

  /**
   * Menghitung nilai SHA-256 row_hash untuk satu baris log audit secara deterministik,
   * mengikuti logika trigger PostgreSQL `audit.chain_hash()`:
   * digest(COALESCE(prev_hash, '') || concat_ws('|', occurred_at, actor_user_id, action, entity, entity_id, before_data, after_data), 'sha256')
   */
  public computeRowHash(
    prevHash: Buffer | null,
    row: {
      occurredAt: string | Date;
      actorUserId?: string | null;
      action: string;
      entity: string;
      entityId?: string | null;
      beforeData?: unknown;
      afterData?: unknown;
    },
  ): Buffer {
    const occurredAtStr =
      row.occurredAt instanceof Date ? row.occurredAt.toISOString() : String(row.occurredAt);

    // concat_ws('|', ...) di PostgreSQL melewatkan nilai NULL
    const parts: string[] = [];
    if (occurredAtStr != null) parts.push(occurredAtStr);
    if (row.actorUserId != null) parts.push(String(row.actorUserId));
    if (row.action != null) parts.push(String(row.action));
    if (row.entity != null) parts.push(String(row.entity));
    if (row.entityId != null) parts.push(String(row.entityId));

    if (row.beforeData != null) {
      parts.push(
        typeof row.beforeData === 'string' ? row.beforeData : JSON.stringify(row.beforeData),
      );
    }
    if (row.afterData != null) {
      parts.push(typeof row.afterData === 'string' ? row.afterData : JSON.stringify(row.afterData));
    }

    const payloadString = parts.join('|');
    const payloadBuffer = Buffer.from(payloadString, 'utf-8');

    const prevBuffer = prevHash || Buffer.alloc(0);
    const combined = Buffer.concat([prevBuffer, payloadBuffer]);

    return crypto.createHash('sha256').update(combined).digest();
  }

  /**
   * Memverifikasi integritas seluruh rantai hash (hash chain) log audit.
   * Mendeteksi jika ada baris yang disunting secara manual, dihapus, disisipkan, atau diubah urutannya.
   */
  public verifyChain(records: AuditLogRecord[]): AuditVerificationResult {
    const tampered: AuditVerificationResult['tamperedRecords'] = [];

    let expectedPrevHash: Buffer | null = null;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      const currentPrevHash = record.prev_hash
        ? Buffer.isBuffer(record.prev_hash)
          ? record.prev_hash
          : Buffer.from(record.prev_hash, 'hex')
        : null;

      const currentRowHash = Buffer.isBuffer(record.row_hash)
        ? record.row_hash
        : Buffer.from(record.row_hash, 'hex');

      // 1. Verifikasi kecocokan rantai: prev_hash baris ini harus sama persis dengan row_hash baris sebelumnya
      if (i > 0) {
        if (!expectedPrevHash || !currentPrevHash || !expectedPrevHash.equals(currentPrevHash)) {
          tampered.push({
            id: record.id,
            reason: 'PREV_HASH_MISMATCH',
            expectedHash: expectedPrevHash?.toString('hex'),
            actualHash: currentPrevHash?.toString('hex'),
          });
        }
      }

      // 2. Hitung ulang row_hash berdasarkan data baris ini
      const computedHash = this.computeRowHash(currentPrevHash, {
        occurredAt: record.occurred_at,
        actorUserId: record.actor_user_id,
        action: record.action,
        entity: record.entity,
        entityId: record.entity_id,
        beforeData: record.before_data,
        afterData: record.after_data,
      });

      if (!computedHash.equals(currentRowHash)) {
        tampered.push({
          id: record.id,
          reason: 'ROW_HASH_MISMATCH',
          expectedHash: computedHash.toString('hex'),
          actualHash: currentRowHash.toString('hex'),
        });
      }

      expectedPrevHash = currentRowHash;
    }

    return {
      isValid: tampered.length === 0,
      totalVerified: records.length,
      tamperedRecords: tampered,
    };
  }

  /**
   * Menulis rekaman log audit ke tabel `audit.audit_logs`.
   * Data sebelum dan sesudah diproses melalui fungsi masking sebelum di-insert.
   * Trigger database `audit.chain_hash()` secara otomatis mengisi `prev_hash` dan `row_hash`.
   */
  public async log(dto: CreateAuditLogDto, pgClient?: Client): Promise<void> {
    const maskedBefore = dto.beforeData ? this.maskSensitive(dto.beforeData) : null;
    const maskedAfter = dto.afterData ? this.maskSensitive(dto.afterData) : null;

    this.logger?.log(
      `[AuditLog] ${dto.action.toUpperCase()} pada ${dto.entity}:${dto.entityId || '-'} oleh actor:${dto.actorUserId || 'ANONYMOUS'}`,
      'AuditService',
      { action: dto.action, entity: dto.entity, entityId: dto.entityId },
    );

    if (!pgClient) {
      // Jika pgClient tidak disediakan langsung (misal dalam unit test), return setelah logging
      return;
    }

    await pgClient.query(
      `INSERT INTO audit.audit_logs (
        actor_user_id,
        actor_ip,
        request_id,
        action,
        entity,
        entity_id,
        before_data,
        after_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        dto.actorUserId || null,
        dto.actorIp || null,
        dto.requestId || null,
        dto.action,
        dto.entity,
        dto.entityId || null,
        maskedBefore ? JSON.stringify(maskedBefore) : null,
        maskedAfter ? JSON.stringify(maskedAfter) : null,
      ],
    );
  }
}
