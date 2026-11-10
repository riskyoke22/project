#!/usr/bin/env node

/**
 * scripts/generate-keys.mjs
 * Menghasilkan kunci acak berkekuatan kriptografis tinggi menggunakan node:crypto.
 * Kunci ini digunakan untuk KEK, DEK, Blind Index Salt, JWT secrets, dan kredensial database.
 * Sesuai aturan: "Skrip untuk membuat kunci acak (jangan menulis kunci di berkas repository)."
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function generateSecureRandomHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateKeys() {
  return {
    APP_SECRET: generateSecureRandomHex(32),
    DEK_ENCRYPTION_KEY: generateSecureRandomHex(32),
    BLIND_INDEX_SALT: generateSecureRandomHex(32),
    JWT_ACCESS_SECRET: generateSecureRandomHex(32),
    JWT_REFRESH_SECRET: generateSecureRandomHex(32),
    POSTGRES_PASSWORD: generateSecureRandomHex(16),
    MINIO_ROOT_PASSWORD: generateSecureRandomHex(16),
  };
}

const keys = generateKeys();
const envLocalPath = path.join(rootDir, '.env.local');
const envExamplePath = path.join(rootDir, '.env.example');

console.log('================================================================');
console.log('  GENERATOR KUNCI KRIPTOGRAFIS - SISTEM TERINTEGRASI');
console.log('================================================================');
console.log('Kunci aman baru berhasil dibuat:\n');

for (const [key, value] of Object.entries(keys)) {
  console.log(`  ${key}=${value}`);
}

console.log('\n----------------------------------------------------------------');

if (fs.existsSync(envExamplePath)) {
  let content = fs.readFileSync(envExamplePath, 'utf8');

  // Gantikan placeholder dengan nilai acak yang baru dibuat
  content = content.replace(
    /APP_SECRET=.*/,
    `APP_SECRET=${keys.APP_SECRET}`,
  );
  content = content.replace(
    /DEK_ENCRYPTION_KEY=.*/,
    `DEK_ENCRYPTION_KEY=${keys.DEK_ENCRYPTION_KEY}`,
  );
  content = content.replace(
    /BLIND_INDEX_SALT=.*/,
    `BLIND_INDEX_SALT=${keys.BLIND_INDEX_SALT}`,
  );
  content = content.replace(
    /JWT_ACCESS_SECRET=.*/,
    `JWT_ACCESS_SECRET=${keys.JWT_ACCESS_SECRET}`,
  );
  content = content.replace(
    /JWT_REFRESH_SECRET=.*/,
    `JWT_REFRESH_SECRET=${keys.JWT_REFRESH_SECRET}`,
  );
  content = content.replace(
    /POSTGRES_PASSWORD=.*/,
    `POSTGRES_PASSWORD=${keys.POSTGRES_PASSWORD}`,
  );
  content = content.replace(
    /DATABASE_URL=postgresql:\/\/postgres:.*@127\.0\.0\.1:5432\/sistem_db/,
    `DATABASE_URL=postgresql://postgres:${keys.POSTGRES_PASSWORD}@127.0.0.1:5432/sistem_db`,
  );
  content = content.replace(
    /MINIO_ROOT_PASSWORD=.*/,
    `MINIO_ROOT_PASSWORD=${keys.MINIO_ROOT_PASSWORD}`,
  );
  content = content.replace(
    /MINIO_SECRET_KEY=.*/,
    `MINIO_SECRET_KEY=${keys.MINIO_ROOT_PASSWORD}`,
  );

  fs.writeFileSync(envLocalPath, content, { encoding: 'utf8', flag: 'w' });
  console.log(`[SUKSES] File .env.local telah dibuat/diperbarui dengan kunci aman baru!`);
  console.log(`Peringatan: .env.local tidak boleh di-commit ke Git (sudah masuk .gitignore).`);
} else {
  console.log(`[INFO] .env.example tidak ditemukan. Silakan salin nilai di atas secara manual.`);
}
console.log('================================================================\n');

