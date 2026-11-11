import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../auth.constants';

/**
 * Dekorator untuk menandai rute endpoint dapat diakses secara publik (tanpa token login).
 * Sesuai prinsip deny-by-default, setiap endpoint publik WAJIB dideklarasikan secara eksplisit.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
