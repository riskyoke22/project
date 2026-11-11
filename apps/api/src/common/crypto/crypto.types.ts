/**
 * Struktur payload envelope enkripsi kolom AES-256-GCM.
 * Membawa metadata versi dan key_id agar mendukung rotasi kunci tanpa downtime.
 */
export interface EncryptedPayload {
  /** Versi format envelope (saat ini 1) */
  v: number;
  /** Identifier Key Encryption Key (KEK) yang dipakai membungkus DEK */
  kid: string;
  /** Initialization vector untuk wrapping DEK (base64) */
  dekIv: string;
  /** Authentication tag untuk wrapping DEK (base64) */
  dekTag: string;
  /** Data Encryption Key (DEK) terenkripsi yang dibungkus KEK (base64) */
  edek: string;
  /** Initialization vector 12-byte untuk payload ciphertext (base64) */
  iv: string;
  /** Authentication tag 16-byte untuk integritas ciphertext (base64) */
  tag: string;
  /** Ciphertext data sensitif (base64) */
  ct: string;
}

export interface EncryptOptions {
  /** Override key_id KEK yang dipakai (default dari konfigurasi saat ini) */
  keyId?: string;
}

export interface Argon2Options {
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
  outputLen?: number;
}
