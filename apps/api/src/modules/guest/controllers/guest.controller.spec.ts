import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuestController } from './guest.controller';
import { GuestService } from '../services/guest.service';
import { ValidationError } from '../../../common/errors/app-error';

describe('GuestController', () => {
  let controller: GuestController;
  let mockService: Partial<GuestService>;

  beforeEach(() => {
    mockService = {
      createPublicVisit: vi.fn(),
      validateBusinessRules: vi.fn(),
    };
    controller = new GuestController(mockService as GuestService);
  });

  it('harus mengembalikan success true dan data ketika input valid', async () => {
    const mockResult = { id: 'visit-123', checkInAt: '2026-01-01T10:00:00.000Z' };
    (mockService.createPublicVisit as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const result = await controller.createVisit({
      fullName: 'Budi Santoso',
      organization: 'PT Contoh',
      purpose: 'Rapat koordinasi',
      hostEmployeeName: 'Pak Andi',
      hostOrgUnitName: 'Bagian Umum',
      partySize: 2,
      phone: '',
      email: '',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResult);
  });

  it('harus throw ValidationError ketika input tidak valid', async () => {
    await expect(
      controller.createVisit({
        fullName: '',
        organization: '',
        purpose: '',
        hostEmployeeName: '',
        partySize: 0,
        phone: '',
        email: '',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('harus throw ValidationError ketika email tidak valid', async () => {
    await expect(
      controller.createVisit({
        fullName: 'Budi',
        organization: '',
        purpose: 'Rapat',
        hostEmployeeName: 'Pak Andi',
        hostOrgUnitName: '',
        partySize: 1,
        phone: '',
        email: 'bukan-email',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('harus menerima input minimal yang valid', async () => {
    const mockResult = { id: 'visit-456', checkInAt: '2026-01-01T10:00:00.000Z' };
    (mockService.createPublicVisit as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const result = await controller.createVisit({
      fullName: 'Siti Aminah',
      organization: '',
      purpose: 'Mengurus dokumen',
      hostEmployeeName: 'Bu Rina',
      hostOrgUnitName: '',
      partySize: 1,
      phone: '',
      email: '',
    });

    expect(result.success).toBe(true);
  });
});
