import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Muat .env.local terlebih dahulu jika ada, kemudian .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sistem_db';
}

export function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function ensureMigrationTable(client: Client): Promise<void> {
  await client.query('CREATE SCHEMA IF NOT EXISTS core;');
  await client.query(`
    CREATE TABLE IF NOT EXISTS core.__migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      hash TEXT NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function runMigrations(
  customClient?: Client,
): Promise<{ executed: string[]; total: number }> {
  const client = customClient || new Client({ connectionString: getDatabaseUrl() });
  const shouldClose = !customClient;

  if (shouldClose) {
    await client.connect();
  }

  try {
    await ensureMigrationTable(client);

    const migrationsDir = path.resolve(__dirname, '..', 'db', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const executed: string[] = [];

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      const hash = calculateHash(sqlContent);

      const checkRes = await client.query(
        'SELECT id, hash FROM core.__migrations WHERE name = $1',
        [file],
      );

      if (checkRes.rows.length > 0) {
        continue;
      }

      console.log(`[MIGRATION] Menjalankan migrasi: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query('INSERT INTO core.__migrations (name, hash) VALUES ($1, $2)', [
          file,
          hash,
        ]);
        await client.query('COMMIT');
        executed.push(file);
        console.log(`[MIGRATION] ✅ Selesai: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATION] ❌ Gagal mengeksekusi migrasi ${file}:`, err);
        throw err;
      }
    }

    return { executed, total: files.length };
  } finally {
    if (shouldClose) {
      await client.end();
    }
  }
}

export async function getMigrationStatus(
  customClient?: Client,
): Promise<
  Array<{ name: string; status: 'APPLIED' | 'PENDING'; executedAt?: Date; hash?: string }>
> {
  const client = customClient || new Client({ connectionString: getDatabaseUrl() });
  const shouldClose = !customClient;

  if (shouldClose) {
    await client.connect();
  }

  try {
    await ensureMigrationTable(client);

    const migrationsDir = path.resolve(__dirname, '..', 'db', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const result = await client.query(
      'SELECT name, hash, executed_at FROM core.__migrations ORDER BY id ASC',
    );
    const appliedMap = new Map<string, { hash: string; executed_at: Date }>();
    for (const row of result.rows) {
      appliedMap.set(row.name, { hash: row.hash, executed_at: row.executed_at });
    }

    return files.map((file) => {
      const applied = appliedMap.get(file);
      if (applied) {
        return {
          name: file,
          status: 'APPLIED',
          executedAt: applied.executed_at,
          hash: applied.hash,
        };
      }
      return {
        name: file,
        status: 'PENDING',
      };
    });
  } finally {
    if (shouldClose) {
      await client.end();
    }
  }
}

if (require.main === module) {
  const isStatus = process.argv.includes('--status') || process.argv.includes('status');

  if (isStatus) {
    getMigrationStatus()
      .then((statuses) => {
        console.log('\n=== STATUS MIGRASI DATABASE ===');
        console.table(
          statuses.map((s) => ({
            Migrasi: s.name,
            Status: s.status,
            'Waktu Eksekusi': s.executedAt ? s.executedAt.toISOString() : '-',
          })),
        );
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error saat memeriksa status migrasi:', err);
        process.exit(1);
      });
  } else {
    runMigrations()
      .then(({ executed, total }) => {
        console.log(
          `\nSelesai! Total ${executed.length} dari ${total} berkas migrasi berhasil diterapkan.`,
        );
        process.exit(0);
      })
      .catch((err) => {
        console.error('Migrasi database gagal:', err);
        process.exit(1);
      });
  }
}
