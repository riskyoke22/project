/**
 * Konfigurasi API client untuk komunikasi frontend ke backend.
 *
 * Menggunakan NEXT_PUBLIC_API_URL dari environment, atau fallback ke /api
 * untuk arsitektur same-origin melalui reverse proxy.
 *
 * Tidak ada secret backend yang masuk ke sini - hanya URL publik.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: { signal?: AbortSignal },
): Promise<ApiResult<T>> {
  try {
    const url = `${API_BASE_URL}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      // Server returned non-JSON (e.g., reverse proxy error page)
      return {
        success: false,
        error: {
          code: `HTTP_${res.status}`,
          message: res.ok
            ? 'Respons server tidak dapat dibaca.'
            : `Server mengembalikan kesalahan (HTTP ${res.status}). Silakan coba beberapa saat lagi.`,
        },
      };
    }
    return data as ApiResult<T>;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'REQUEST_ABORTED',
          message: 'Permintaan dibatalkan.',
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message:
          'Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda atau coba beberapa saat lagi.',
      },
    };
  }
}
