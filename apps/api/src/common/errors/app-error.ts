/**
 * Kelas dasar error domain aplikasi dengan kode error yang stabil.
 * Kode error stabil memungkinkan antarmuka (frontend) menampilkan pesan multibahasa (i18n)
 * yang sesuai tanpa terikat pada teks pesan teknis backend.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string = 'INTERNAL_SERVER_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Error ketika entitas/sumber daya tidak ditemukan di database (HTTP 404) */
export class NotFoundError extends AppError {
  constructor(
    message: string = 'Sumber daya tidak ditemukan',
    code: string = 'RESOURCE_NOT_FOUND',
    details?: unknown,
  ) {
    super(message, code, 404, true, details);
  }
}

/** Error ketika pengguna belum terotentikasi / token tidak valid (HTTP 401) */
export class UnauthorizedError extends AppError {
  constructor(
    message: string = 'Autentikasi diperlukan',
    code: string = 'UNAUTHORIZED',
    details?: unknown,
  ) {
    super(message, code, 401, true, details);
  }
}

/** Error ketika pengguna tidak memiliki hak akses atau izin yang cukup (HTTP 403) */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Akses ditolak', code: string = 'FORBIDDEN', details?: unknown) {
    super(message, code, 403, true, details);
  }
}

/** Error konflik data, misal duplikasi kunci unik atau versi data (HTTP 409) */
export class ConflictError extends AppError {
  constructor(
    message: string = 'Konflik data terdeteksi',
    code: string = 'CONFLICT',
    details?: unknown,
  ) {
    super(message, code, 409, true, details);
  }
}

/** Error validasi input DTO / parameter (HTTP 422 atau 400) */
export class ValidationError extends AppError {
  constructor(
    message: string = 'Data masukan tidak valid',
    code: string = 'VALIDATION_ERROR',
    details?: unknown,
  ) {
    super(message, code, 422, true, details);
  }
}

/** Error pelanggaran aturan bisnis (HTTP 400 / 422) dengan kode spesifik modul */
export class BusinessRuleError extends AppError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, 400, true, details);
  }
}

/** Error pembatasan laju panggilan API (HTTP 429) */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Batas laju permintaan terlampaui. Silakan coba sesaat lagi.',
    code: string = 'RATE_LIMIT_EXCEEDED',
  ) {
    super(message, code, 429, true);
  }
}
