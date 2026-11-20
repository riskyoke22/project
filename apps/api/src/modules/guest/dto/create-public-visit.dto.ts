import { z } from 'zod';

/**
 * Skema validasi untuk pembuatan kunjungan publik (walk-in) Buku Tamu.
 *
 * Data sensitif (telepon, email) bersifat opsional dan akan dienkripsi
 * sebelum disimpan ke database.
 */
export const CreatePublicVisitSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Nama lengkap wajib diisi.')
    .max(200, 'Nama terlalu panjang (maks 200 karakter).'),
  organization: z
    .string()
    .trim()
    .max(200, 'Nama instansi terlalu panjang.')
    .optional()
    .or(z.literal('')),
  purpose: z
    .string()
    .trim()
    .min(1, 'Tujuan kunjungan wajib diisi.')
    .max(500, 'Tujuan terlalu panjang (maks 500 karakter).'),
  hostEmployeeName: z
    .string()
    .trim()
    .min(1, 'Nama yang dikunjungi wajib diisi.')
    .max(200, 'Nama terlalu panjang (maks 200 karakter).'),
  hostOrgUnitName: z
    .string()
    .trim()
    .max(200, 'Nama bagian terlalu panjang.')
    .optional()
    .or(z.literal('')),
  partySize: z.coerce
    .number()
    .int('Jumlah peserta harus bilangan bulat.')
    .min(1, 'Jumlah peserta minimal 1.')
    .max(50, 'Jumlah peserta maksimal 50.'),
  phone: z.string().trim().max(20, 'Nomor telepon terlalu panjang.').optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Format email tidak valid.')
    .max(255, 'Email terlalu panjang.')
    .optional()
    .or(z.literal('')),
  consentGiven: z.boolean().optional().default(true),
});

export type CreatePublicVisitDto = z.infer<typeof CreatePublicVisitSchema>;

export interface PublicVisitResponse {
  id: string;
  checkInAt: string;
}
