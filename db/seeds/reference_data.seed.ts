export interface EmploymentStatusSeed {
  code: string;
  name: string;
}

export interface GradeSeed {
  code: string;
  name: string;
  rankLevel: number;
}

export interface LeaveTypeSeed {
  code: string;
  name: string;
  annualQuotaDays: number | null;
  requiresAttachment: boolean;
  isPaid: boolean;
}

export interface BehaviorAspectSeed {
  code: string;
  name: string;
  weight: number;
}

export interface ArchiveCategorySeed {
  code: string;
  name: string;
  activeRetentionYears: number;
  inactiveRetentionYears: number;
  finalDisposition: 'destroy' | 'permanent' | 'review';
}

/**
 * Data Referensi Awal Sistem.
 * Seluruh data awal ini ditandai jelas sebagai:
 * "(contoh, ganti sesuai kebijakan organisasi)"
 */
export const REFERENCE_DATA_SEEDS = {
  employmentStatuses: [
    {
      code: 'PERMANENT',
      name: 'Pegawai Tetap (contoh, ganti sesuai kebijakan organisasi)',
    },
    {
      code: 'CONTRACT',
      name: 'Pegawai Kontrak / PKWT (contoh, ganti sesuai kebijakan organisasi)',
    },
    {
      code: 'PROBATION',
      name: 'Masa Percobaan (contoh, ganti sesuai kebijakan organisasi)',
    },
  ] as EmploymentStatusSeed[],

  grades: [
    {
      code: 'III/a',
      name: 'Penata Muda - Golongan III/a (contoh, ganti sesuai kebijakan organisasi)',
      rankLevel: 31,
    },
    {
      code: 'III/b',
      name: 'Penata Muda Tingkat I - Golongan III/b (contoh, ganti sesuai kebijakan organisasi)',
      rankLevel: 32,
    },
    {
      code: 'III/c',
      name: 'Penata - Golongan III/c (contoh, ganti sesuai kebijakan organisasi)',
      rankLevel: 33,
    },
    {
      code: 'IV/a',
      name: 'Pembina - Golongan IV/a (contoh, ganti sesuai kebijakan organisasi)',
      rankLevel: 41,
    },
  ] as GradeSeed[],

  leaveTypes: [
    {
      code: 'ANNUAL',
      name: 'Cuti Tahunan (contoh, ganti sesuai kebijakan organisasi)',
      annualQuotaDays: 12.0,
      requiresAttachment: false,
      isPaid: true,
    },
    {
      code: 'SICK',
      name: 'Cuti Sakit (contoh, ganti sesuai kebijakan organisasi)',
      annualQuotaDays: 14.0,
      requiresAttachment: true,
      isPaid: true,
    },
    {
      code: 'MATERNITY',
      name: 'Cuti Melahirkan (contoh, ganti sesuai kebijakan organisasi)',
      annualQuotaDays: 90.0,
      requiresAttachment: true,
      isPaid: true,
    },
    {
      code: 'IMPORTANT_REASON',
      name: 'Cuti Alasan Penting (contoh, ganti sesuai kebijakan organisasi)',
      annualQuotaDays: 5.0,
      requiresAttachment: false,
      isPaid: true,
    },
  ] as LeaveTypeSeed[],

  behaviorAspects: [
    {
      code: 'INTEGRITY',
      name: 'Integritas (contoh, ganti sesuai kebijakan organisasi)',
      weight: 20.0,
    },
    {
      code: 'COMMITMENT',
      name: 'Komitmen (contoh, ganti sesuai kebijakan organisasi)',
      weight: 20.0,
    },
    {
      code: 'WORK_QUALITY',
      name: 'Kualitas Kerja (contoh, ganti sesuai kebijakan organisasi)',
      weight: 20.0,
    },
    {
      code: 'DISCIPLINE',
      name: 'Disiplin (contoh, ganti sesuai kebijakan organisasi)',
      weight: 20.0,
    },
    {
      code: 'TEAMWORK',
      name: 'Kerjasama Tim (contoh, ganti sesuai kebijakan organisasi)',
      weight: 20.0,
    },
  ] as BehaviorAspectSeed[],

  archiveCategories: [
    {
      code: 'UM',
      name: 'Umum dan Tata Usaha (contoh, ganti sesuai kebijakan organisasi)',
      activeRetentionYears: 2,
      inactiveRetentionYears: 5,
      finalDisposition: 'destroy',
    },
    {
      code: 'KP',
      name: 'Kepegawaian dan SDM (contoh, ganti sesuai kebijakan organisasi)',
      activeRetentionYears: 5,
      inactiveRetentionYears: 10,
      finalDisposition: 'permanent',
    },
    {
      code: 'KN',
      name: 'Kinerja Organisasi (contoh, ganti sesuai kebijakan organisasi)',
      activeRetentionYears: 3,
      inactiveRetentionYears: 5,
      finalDisposition: 'review',
    },
  ] as ArchiveCategorySeed[],
};
