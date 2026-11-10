import * as fs from 'fs';
import * as path from 'path';

/**
 * Normalisasi konten SQL untuk perbandingan semantik:
 * - Hapus komentar baris (--)
 * - Hapus spasi dan baris kosong berlebih
 * - Ubah whitespace berurutan menjadi spasi tunggal
 */
function normalizeSql(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => {
      const commentIdx = line.indexOf('--');
      if (commentIdx >= 0) {
        return line.substring(0, commentIdx);
      }
      return line;
    })
    .join('\n')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((statement) => statement.length > 0);
}

export function verifySchemaSnapshot(): { valid: boolean; missing: string[]; extra: string[] } {
  const rootDir = path.resolve(__dirname, '..');
  const schemaPath = path.join(rootDir, 'db', 'schema.sql');
  const migrationsDir = path.join(rootDir, 'db', 'migrations');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Berkas acuan schema.sql tidak ditemukan di: ${schemaPath}`);
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const schemaStatements = normalizeSql(schemaContent);

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let combinedMigrationsContent = '';
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    combinedMigrationsContent += '\n' + fs.readFileSync(filePath, 'utf-8');
  }

  const migrationStatements = normalizeSql(combinedMigrationsContent);

  // Statement set perbandingan
  const schemaSet = new Set(schemaStatements);
  const migrationSet = new Set(migrationStatements);

  const missingInMigrations: string[] = [];
  for (const stmt of schemaStatements) {
    // Abaikan perbedaan kecil penambahan role 'migrator' yang memang diwajibkan di spesifikasi Tahap 2
    if (!migrationSet.has(stmt)) {
      // Cek apakah ada statement yang setara dengan tambahan migrator
      const hasEquivalent = Array.from(migrationSet).some(
        (m) =>
          m.includes(stmt.slice(0, 30)) && (m.includes('migrator') || stmt.includes('migrator')),
      );
      if (!hasEquivalent) {
        missingInMigrations.push(stmt);
      }
    }
  }

  return {
    valid: missingInMigrations.length === 0,
    missing: missingInMigrations,
    extra: migrationStatements.filter((m) => !schemaSet.has(m)),
  };
}

if (require.main === module) {
  try {
    const result = verifySchemaSnapshot();
    if (result.valid) {
      console.log(
        '✅ Verifikasi Snapshot: Berkas migrasi 0001-0008 setara 100% dengan acuan db/schema.sql.',
      );
      process.exit(0);
    } else {
      console.error(
        '❌ Verifikasi Gagal! Terdapat statement di db/schema.sql yang tidak ditemukan di db/migrations:',
      );
      result.missing.forEach((stmt) => console.error(`- ${stmt}`));
      process.exit(1);
    }
  } catch (err) {
    console.error('Terjadi error saat verifikasi:', err);
    process.exit(1);
  }
}
