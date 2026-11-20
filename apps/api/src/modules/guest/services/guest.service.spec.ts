import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuestService } from './guest.service';
import { TransactionManager } from '../../../common/database/transaction';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { ConflictError, ValidationError } from '../../../common/errors/app-error';

describe('GuestService', () => {
  let service: GuestService;
  let mockTransactionManager: Partial<TransactionManager>;
  let mockCryptoService: Partial<CryptoService>;

  beforeEach(() => {
    mockTransactionManager = {
      runInTransaction: vi.fn(),
    };
    mockCryptoService = {
      encrypt: vi.fn().mockImplementation((val: string) => `enc:v1:mock_${val}`),
      decrypt: vi.fn().mockImplementation((val: string) => val.replace('enc:v1:mock_', '')),
    };
    service = new GuestService(
      mockTransactionManager as TransactionManager,
      mockCryptoService as CryptoService,
    );
  });

  describe('encryptToBytea & decryptBytea', () => {
    it('mengenkripsi plaintext menjadi Buffer untuk kolom bytea', () => {
      const result = service.encryptToBytea('081234567890');
      expect(result).toBeInstanceOf(Buffer);
      expect(result?.toString('utf-8')).toBe('enc:v1:mock_081234567890');
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith('081234567890');
    });

    it('mengembalikan null jika plaintext kosong', () => {
      expect(service.encryptToBytea('')).toBeNull();
      expect(service.encryptToBytea(null)).toBeNull();
      expect(service.encryptToBytea(undefined)).toBeNull();
    });

    it('mendekripsi Buffer bytea kembali menjadi string plaintext', () => {
      const buffer = Buffer.from('enc:v1:mock_081234567890', 'utf-8');
      const decrypted = service.decryptBytea(buffer);
      expect(decrypted).toBe('081234567890');
      expect(mockCryptoService.decrypt).toHaveBeenCalledWith('enc:v1:mock_081234567890');
    });

    it('mengembalikan null jika buffer kosong', () => {
      expect(service.decryptBytea(null)).toBeNull();
      expect(service.decryptBytea(undefined)).toBeNull();
    });
  });

  describe('validateBusinessRules', () => {
    it('harus menerima nama host yang valid dan persetujuan diberikan', () => {
      expect(() =>
        service.validateBusinessRules({
          fullName: 'Budi',
          purpose: 'Meeting',
          hostEmployeeName: 'Pak Andi',
          partySize: 1,
          organization: '',
          hostOrgUnitName: '',
          phone: '',
          email: '',
          consentGiven: true,
        }),
      ).not.toThrow();
    });

    it('harus menolak jika consentGiven bernilai false', () => {
      expect(() =>
        service.validateBusinessRules({
          fullName: 'Budi',
          purpose: 'Meeting',
          hostEmployeeName: 'Pak Andi',
          partySize: 1,
          organization: '',
          hostOrgUnitName: '',
          phone: '',
          email: '',
          consentGiven: false,
        }),
      ).toThrow(ValidationError);
    });

    it('harus menolak nama host yang hanya angka', () => {
      expect(() =>
        service.validateBusinessRules({
          fullName: 'Budi',
          purpose: 'Meeting',
          hostEmployeeName: '12345',
          partySize: 1,
          organization: '',
          hostOrgUnitName: '',
          phone: '',
          email: '',
          consentGiven: true,
        }),
      ).toThrow(ValidationError);
    });
  });

  describe('createPublicVisit', () => {
    it('harus memanggil runInTransaction, mengenkripsi phone/email, dan mengembalikan id + checkInAt', async () => {
      const mockVisitId = 'visit-uuid-123';
      const mockCheckInAt = new Date('2026-01-01T10:00:00Z');
      const queryCalls: Array<{ sql: string; params: unknown[] }> = [];

      (mockTransactionManager.runInTransaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (work: (client: unknown) => Promise<unknown>) => {
          const mockClient = {
            query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
              queryCalls.push({ sql, params });
              if (sql.includes('SELECT v.id FROM guest.visits')) {
                // Duplicate check: tidak ada kunjungan duplikat
                return Promise.resolve({ rows: [] });
              }
              if (sql.includes('INSERT INTO guest.visitors')) {
                return Promise.resolve({ rows: [{ id: 'visitor-uuid-123' }] });
              }
              if (sql.includes('INSERT INTO guest.visits')) {
                return Promise.resolve({
                  rows: [{ id: mockVisitId, check_in_at: mockCheckInAt }],
                });
              }
              return Promise.resolve({ rows: [] });
            }),
          };
          return work(mockClient);
        },
      );

      const result = await service.createPublicVisit({
        fullName: 'Budi Santoso',
        organization: 'PT Contoh',
        purpose: 'Rapat koordinasi',
        hostEmployeeName: 'Pak Andi Wijaya',
        hostOrgUnitName: 'Bagian Umum',
        partySize: 2,
        phone: '081234567890',
        email: 'budi@contoh.id',
        consentGiven: true,
      });

      expect(result.id).toBe(mockVisitId);
      expect(result.checkInAt).toBe(mockCheckInAt.toISOString());
      expect(mockTransactionManager.runInTransaction).toHaveBeenCalledTimes(1);

      // Verifikasi query visitor menyertakan data phone_enc dan email_enc dalam bentuk Buffer
      const visitorInsert = queryCalls.find((q) => q.sql.includes('INSERT INTO guest.visitors'));
      expect(visitorInsert).toBeDefined();
      expect(visitorInsert?.params[0]).toBe('Budi Santoso');
      expect(visitorInsert?.params[1]).toBe('PT Contoh');
      expect(visitorInsert?.params[2]).toBeInstanceOf(Buffer);
      expect(visitorInsert?.params[3]).toBeInstanceOf(Buffer);
    });

    it('harus menolak pengiriman berulang / duplikat dalam rentang 1 menit', async () => {
      (mockTransactionManager.runInTransaction as ReturnType<typeof vi.fn>).mockImplementation(
        async (work: (client: unknown) => Promise<unknown>) => {
          const mockClient = {
            query: vi.fn().mockImplementation((sql: string) => {
              if (sql.includes('SELECT v.id FROM guest.visits')) {
                return Promise.resolve({ rows: [{ id: 'existing-visit-id' }] });
              }
              return Promise.resolve({ rows: [] });
            }),
          };
          return work(mockClient);
        },
      );

      await expect(
        service.createPublicVisit({
          fullName: 'Budi Santoso',
          organization: 'PT Contoh',
          purpose: 'Rapat koordinasi',
          hostEmployeeName: 'Pak Andi Wijaya',
          hostOrgUnitName: 'Bagian Umum',
          partySize: 1,
          phone: '',
          email: '',
          consentGiven: true,
        }),
      ).rejects.toThrow(ConflictError);
    });
  });
});
