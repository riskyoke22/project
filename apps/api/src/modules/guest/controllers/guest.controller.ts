import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { GuestService } from '../services/guest.service';
import { CreatePublicVisitSchema, CreatePublicVisitDto } from '../dto/create-public-visit.dto';
import { Public } from '../../../common/auth/decorators/public.decorator';
import { ValidationError } from '../../../common/errors/app-error';

/**
 * GuestController — endpoint untuk modul Buku Tamu.
 *
 * POST /guest/visits — PUBLIC: Membuat kunjungan baru (walk-in).
 *   Tidak memerlukan autentikasi. Data disimpan dengan consent_at.
 *
 * Pembacaan data kunjungan (GET) belum diimplementasikan dan akan
 * memerlukan autentikasi + authorization (@RequirePermission).
 */
@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  /**
   * Endpoint publik untuk mencatat kunjungan Buku Tamu.
   * Dapat diakses tanpa login. Data divalidasi dengan Zod schema.
   */
  @Public()
  @Post('visits')
  @HttpCode(HttpStatus.CREATED)
  async createVisit(@Body() body: unknown) {
    // Validasi input dengan Zod schema
    const parseResult = CreatePublicVisitSchema.safeParse(body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      throw new ValidationError(
        'Data masukan tidak valid. Periksa kembali isian Anda.',
        'VISIT_VALIDATION_FAILED',
        { fields: fieldErrors },
      );
    }

    const dto: CreatePublicVisitDto = parseResult.data;

    // Validasi aturan bisnis tambahan
    this.guestService.validateBusinessRules(dto);

    // Simpan kunjungan
    const result = await this.guestService.createPublicVisit(dto);

    return {
      success: true,
      data: result,
    };
  }
}
