import { describe, expect, it, beforeEach } from 'vitest';
import { AuditService } from './audit.service';
import { AuditLogRecord } from './audit.types';

describe('AuditService - Masking Data & Verifikasi Rantai Hash (Hash Chain)', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService();
  });

  describe('Masking Data Sensitif', () => {
    it('menyensor seluruh field sensitif (password, NIK, token, *_enc) dan mempertahankan field aman', () => {
      const sensitiveInput = {
        id: 'emp-101',
        full_name: 'Ahmad Dahlan',
        password: 'PasswordSuperRahasia!123',
        nik: '3201123456780001',
        national_id: '3201123456780001',
        token: 'jwt-access-token-999',
        nik_enc: 'enc:v1:base64encrypteddata==',
        phone_enc: 'enc:v1:base64phone==',
        nested: {
          department: 'Kepegawaian',
          secret_key: 'top-secret',
          mfa_secret: 'JBSWY3DPEHPK3PXP',
        },
      };

      const masked = auditService.maskSensitive(sensitiveInput);

      expect(masked.id).toBe('emp-101');
      expect(masked.full_name).toBe('Ahmad Dahlan');
      expect(masked.nested.department).toBe('Kepegawaian');

      // Seluruh data sensitif wajib disensor menjadi [REDACTED]
      expect(masked.password).toBe('[REDACTED]');
      expect(masked.nik).toBe('[REDACTED]');
      expect(masked.national_id).toBe('[REDACTED]');
      expect(masked.token).toBe('[REDACTED]');
      expect(masked.nik_enc).toBe('[REDACTED]');
      expect(masked.phone_enc).toBe('[REDACTED]');
      expect(masked.nested.secret_key).toBe('[REDACTED]');
      expect(masked.nested.mfa_secret).toBe('[REDACTED]');
    });

    it('menangani data array dan null secara aman tanpa error', () => {
      expect(auditService.maskSensitive(null)).toBeNull();
      expect(auditService.maskSensitive(undefined)).toBeUndefined();

      const arrayInput = [
        { name: 'Item 1', password: 'p1' },
        { name: 'Item 2', token: 't2' },
      ];
      const maskedArray = auditService.maskSensitive(arrayInput);
      expect(maskedArray[0].password).toBe('[REDACTED]');
      expect(maskedArray[1].token).toBe('[REDACTED]');
      expect(maskedArray[0].name).toBe('Item 1');
    });
  });

  describe('Rantai Hash (Hash Chain Tamper-Evident)', () => {
    function buildMockChain(): AuditLogRecord[] {
      const records: AuditLogRecord[] = [];

      const rawItems = [
        {
          id: 1,
          occurred_at: '2026-11-10T08:00:00.000Z',
          actor_user_id: 'usr-admin-1',
          action: 'login',
          entity: 'iam.users',
          entity_id: 'usr-admin-1',
          before_data: null,
          after_data: { ip: '127.0.0.1' },
        },
        {
          id: 2,
          occurred_at: '2026-11-10T08:05:00.000Z',
          actor_user_id: 'usr-admin-1',
          action: 'create',
          entity: 'hr.employees',
          entity_id: 'emp-101',
          before_data: null,
          after_data: { full_name: 'Budi Santoso', status: 'ACTIVE' },
        },
        {
          id: 3,
          occurred_at: '2026-11-10T08:10:00.000Z',
          actor_user_id: 'usr-admin-1',
          action: 'update',
          entity: 'hr.employees',
          entity_id: 'emp-101',
          before_data: { full_name: 'Budi Santoso', status: 'ACTIVE' },
          after_data: { full_name: 'Budi Santoso, S.Kom', status: 'ACTIVE' },
        },
        {
          id: 4,
          occurred_at: '2026-11-10T08:15:00.000Z',
          actor_user_id: 'usr-admin-1',
          action: 'export',
          entity: 'hr.employees',
          entity_id: null,
          before_data: null,
          after_data: { export_type: 'csv', count: 1 },
        },
      ];

      let prevHash: Buffer | null = null;

      for (const item of rawItems) {
        const rowHash = auditService.computeRowHash(prevHash, {
          occurredAt: item.occurred_at,
          actorUserId: item.actor_user_id,
          action: item.action,
          entity: item.entity,
          entityId: item.entity_id,
          beforeData: item.before_data,
          afterData: item.after_data,
        });

        records.push({
          ...item,
          prev_hash: prevHash,
          row_hash: rowHash,
        });

        prevHash = rowHash;
      }

      return records;
    }

    it('memvalidasi rantai hash yang sah (valid chain) dengan hasil isValid: true', () => {
      const chain = buildMockChain();
      const result = auditService.verifyChain(chain);

      expect(result.isValid).toBe(true);
      expect(result.totalVerified).toBe(4);
      expect(result.tamperedRecords).toHaveLength(0);
    });

    it('mendeteksi jika ada baris yang isinya disunting secara manual (ROW_HASH_MISMATCH)', () => {
      const chain = buildMockChain();

      // Penyerang menyunting after_data pada baris ke-2 langsung di database
      chain[1].after_data = { full_name: 'Budi HACKED', status: 'ACTIVE' };

      const result = auditService.verifyChain(chain);

      expect(result.isValid).toBe(false);
      expect(result.tamperedRecords.length).toBeGreaterThanOrEqual(1);

      // Baris ke-2 terdeteksi ROW_HASH_MISMATCH
      const tamperedRecord = result.tamperedRecords.find((r) => r.id === 2);
      expect(tamperedRecord).toBeDefined();
      expect(tamperedRecord?.reason).toBe('ROW_HASH_MISMATCH');
    });

    it('mendeteksi jika ada baris yang diputus rantai prev_hash-nya (PREV_HASH_MISMATCH)', () => {
      const chain = buildMockChain();

      // Penyerang mencoba memalsukan prev_hash baris ke-3
      chain[2].prev_hash = Buffer.from(
        '0000000000000000000000000000000000000000000000000000000000000000',
        'hex',
      );

      const result = auditService.verifyChain(chain);

      expect(result.isValid).toBe(false);
      const tamperedRecord = result.tamperedRecords.find((r) => r.id === 3);
      expect(tamperedRecord).toBeDefined();
      expect(tamperedRecord?.reason).toBe('PREV_HASH_MISMATCH');
    });

    it('mendeteksi penghapusan satu baris dari tengah rantai audit', () => {
      const chain = buildMockChain();

      // Penyerang menghapus baris ke-2 (id: 2) dari database
      chain.splice(1, 1);

      // Sekarang baris ke-3 menyambung langsung setelah baris ke-1,
      // sehingga prev_hash baris ke-3 tidak lagi cocok dengan row_hash baris ke-1
      const result = auditService.verifyChain(chain);

      expect(result.isValid).toBe(false);
      const brokenLink = result.tamperedRecords.find((r) => r.id === 3);
      expect(brokenLink).toBeDefined();
      expect(brokenLink?.reason).toBe('PREV_HASH_MISMATCH');
    });
  });
});
