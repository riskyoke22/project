import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { runMigrations } from '../../../scripts/migrate';
import { runSeeds } from '../../../scripts/seed';
import { execSync } from 'child_process';

function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('Database Integration Tests (Real PostgreSQL / Testcontainers)', () => {
  let client: Client | null = null;
  let container: { stop: () => Promise<unknown>; getConnectionUri: () => string } | null = null;
  const dockerPresent = isDockerAvailable();
  const testDbUrl = process.env.TEST_DATABASE_URL;

  beforeAll(async () => {
    if (testDbUrl) {
      client = new Client({ connectionString: testDbUrl });
      await client.connect();
    } else if (dockerPresent) {
      const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
      container = await new PostgreSqlContainer('postgres:17-alpine')
        .withDatabase('sistem_test_db')
        .withUsername('postgres')
        .withPassword('postgres')
        .start();

      client = new Client({ connectionString: container.getConnectionUri() });
      await client.connect();
    } else {
      console.warn(
        '\n⚠️ [CATATAN JUJUR INTEGRASI] Docker daemon atau PostgreSQL lokal tidak aktif di laptop pengembang.\n' +
          'Pengujian integrasi terhadap database PostgreSQL nyata akan berjalan otomatis pada CI GitHub Actions (ubuntu-latest).\n',
      );
    }
  }, 120000);

  afterAll(async () => {
    if (client) {
      await client.end();
    }
    if (container) {
      await container.stop();
    }
  });

  const conditionalIt = dockerPresent || testDbUrl ? it : it.skip;

  conditionalIt('(a) harus berhasil menjalankan seluruh migrasi 0001-0008 dari nol', async () => {
    expect(client).toBeDefined();
    const result = await runMigrations(client!);
    expect(result.executed.length).toBe(8);

    // Verifikasi tabel pada semua skema terbuat
    const tableCheck = await client!.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema IN ('core', 'hr', 'perf', 'archive', 'guest', 'audit')
    `);
    expect(tableCheck.rows.length).toBeGreaterThan(20);
  });

  conditionalIt('(b) harus idempoten saat menjalankan seed dua kali berturut-turut', async () => {
    expect(client).toBeDefined();

    // Jalankan seed pertama kali
    await runSeeds(client!);

    const initialPerms = await client!.query('SELECT COUNT(*) as count FROM core.permissions');
    const initialRoles = await client!.query('SELECT COUNT(*) as count FROM core.roles');
    const initialStatuses = await client!.query(
      'SELECT COUNT(*) as count FROM hr.employment_statuses',
    );

    // Jalankan seed kedua kali (wajib sukses tanpa error duplikasi)
    await expect(runSeeds(client!)).resolves.not.toThrow();

    const secondPerms = await client!.query('SELECT COUNT(*) as count FROM core.permissions');
    const secondRoles = await client!.query('SELECT COUNT(*) as count FROM core.roles');
    const secondStatuses = await client!.query(
      'SELECT COUNT(*) as count FROM hr.employment_statuses',
    );

    expect(secondPerms.rows[0].count).toBe(initialPerms.rows[0].count);
    expect(secondRoles.rows[0].count).toBe(initialRoles.rows[0].count);
    expect(secondStatuses.rows[0].count).toBe(initialStatuses.rows[0].count);
  });

  describe('(c) Pengujian Constraint Kunci Database', () => {
    conditionalIt(
      '1. tumpang tindih penempatan jabatan utama (is_primary) harus ditolak',
      async () => {
        expect(client).toBeDefined();

        // Buat unit organisasi dan pegawai dummy
        const orgUnitRes = await client!.query(`
        INSERT INTO core.org_units (code, name, unit_type, path)
        VALUES ('TEST_DIV', 'Divisi Uji', 'division', 'root.test_div')
        RETURNING id
      `);
        const orgUnitId = orgUnitRes.rows[0].id;

        const empRes = await client!.query(`
        INSERT INTO hr.employees (employee_number, full_name)
        VALUES ('EMP_TEST_001', 'Budi Penguji')
        RETURNING id
      `);
        const employeeId = empRes.rows[0].id;

        // Penempatan pertama: 2026-01-01 s.d. 2026-06-30
        await client!.query(`
        INSERT INTO hr.employee_assignments (employee_id, org_unit_id, start_date, end_date, is_primary)
        VALUES ('${employeeId}', '${orgUnitId}', '2026-01-01', '2026-06-30', true)
      `);

        // Penempatan kedua yang bertumpang tindih: 2026-04-01 s.d. 2026-09-30 (wajib ditolak exclusion constraint)
        await expect(
          client!.query(`
          INSERT INTO hr.employee_assignments (employee_id, org_unit_id, start_date, end_date, is_primary)
          VALUES ('${employeeId}', '${orgUnitId}', '2026-04-01', '2026-09-30', true)
        `),
        ).rejects.toThrow();
      },
    );

    conditionalIt(
      '2. audit.audit_logs harus append-only (UPDATE, DELETE, TRUNCATE ditolak)',
      async () => {
        expect(client).toBeDefined();

        // Insert log audit
        const insertRes = await client!.query(`
        INSERT INTO audit.audit_logs (action, entity, entity_id, row_hash)
        VALUES ('create', 'hr.employees', 'EMP_TEST_001', '\\x1234'::bytea)
        RETURNING id
      `);
        const logId = insertRes.rows[0].id;

        // Coba UPDATE -> wajib gagal memicu trigger audit.forbid_change
        await expect(
          client!.query(`UPDATE audit.audit_logs SET action = 'tampered' WHERE id = ${logId}`),
        ).rejects.toThrow(/append-only/i);

        // Coba DELETE -> wajib gagal memicu trigger audit.forbid_change
        await expect(
          client!.query(`DELETE FROM audit.audit_logs WHERE id = ${logId}`),
        ).rejects.toThrow(/append-only/i);

        // Coba TRUNCATE -> wajib gagal memicu trigger audit.forbid_change
        await expect(client!.query('TRUNCATE audit.audit_logs')).rejects.toThrow(/append-only/i);
      },
    );

    conditionalIt(
      '3. current_version_id pada archive.documents harus DEFERRABLE INITIALLY DEFERRED',
      async () => {
        expect(client).toBeDefined();

        const orgRes = await client!.query("SELECT id FROM core.org_units WHERE code = 'TEST_DIV'");
        const orgUnitId = orgRes.rows[0].id;

        // Dalam transaksi, insert dokumen dengan current_version_id yang belum ada,
        // lalu insert versi dokumen, baru commit.
        await client!.query('BEGIN');

        const docId = '11111111-1111-4111-8111-111111111111';
        const versionId = '22222222-2222-4222-8222-222222222222';

        // Buat file metadata dummy di core.files
        await client!.query(`
        INSERT INTO core.files (storage_bucket, storage_key, original_name, mime_type, size_bytes, sha256)
        VALUES ('test-bucket', 'key-doc-1', 'doc.pdf', 'application/pdf', 1024, '\\xabcd'::bytea)
        ON CONFLICT DO NOTHING
      `);
        const fileRes = await client!.query(
          "SELECT id FROM core.files WHERE storage_key = 'key-doc-1'",
        );
        const fileId = fileRes.rows[0].id;

        // Insert dokumen yang merujuk versionId yang belum ada
        await client!.query(`
        INSERT INTO archive.documents (id, title, doc_type, owner_org_unit_id, current_version_id)
        VALUES ('${docId}', 'Surat Keputusan', 'decree', '${orgUnitId}', '${versionId}')
      `);

        // Sekarang baru insert versi dokumen dengan id = versionId
        await client!.query(`
        INSERT INTO archive.document_versions (id, document_id, version_no, file_id)
        VALUES ('${versionId}', '${docId}', 1, '${fileId}')
      `);

        // Commit harus berhasil karena constraint deferrable dievaluasi saat COMMIT
        await expect(client!.query('COMMIT')).resolves.not.toThrow();
      },
    );

    conditionalIt(
      '4. check constraint bobot perf.goals harus menolak bobot <= 0 atau > 100',
      async () => {
        expect(client).toBeDefined();

        // Buat cycle dan employee dummy
        const cycleRes = await client!.query(`
        INSERT INTO perf.cycles (name, year, start_date, end_date)
        VALUES ('Siklus 2026', 2026, '2026-01-01', '2026-12-31')
        RETURNING id
      `);
        const cycleId = cycleRes.rows[0].id;

        const empRes = await client!.query(
          "SELECT id FROM hr.employees WHERE employee_number = 'EMP_TEST_001'",
        );
        const employeeId = empRes.rows[0].id;

        // Bobot 0 -> wajib ditolak
        await expect(
          client!.query(`
          INSERT INTO perf.goals (cycle_id, employee_id, title, weight)
          VALUES ('${cycleId}', '${employeeId}', 'Target Gagal 0', 0)
        `),
        ).rejects.toThrow();

        // Bobot 105 -> wajib ditolak
        await expect(
          client!.query(`
          INSERT INTO perf.goals (cycle_id, employee_id, title, weight)
          VALUES ('${cycleId}', '${employeeId}', 'Target Gagal 105', 105)
        `),
        ).rejects.toThrow();

        // Bobot valid (50) -> sukses
        await expect(
          client!.query(`
          INSERT INTO perf.goals (cycle_id, employee_id, title, weight)
          VALUES ('${cycleId}', '${employeeId}', 'Target Sukses', 50)
        `),
        ).resolves.not.toThrow();
      },
    );
  });

  conditionalIt(
    '(d) role app_rw tidak memiliki izin UPDATE atau DELETE pada audit.audit_logs',
    async () => {
      expect(client).toBeDefined();

      // Buat user database sementara yang meng-inherit role app_rw
      await client!.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'test_app_user') THEN
          CREATE ROLE test_app_user LOGIN PASSWORD 'test_password';
          GRANT app_rw TO test_app_user;
        END IF;
      END $$;
    `);

      // Ganti role aktif sesi menjadi test_app_user
      await client!.query('SET ROLE test_app_user;');

      // app_rw diizinkan INSERT
      await expect(
        client!.query(`
        INSERT INTO audit.audit_logs (action, entity, entity_id, row_hash)
        VALUES ('login', 'core.users', 'U1', '\\xbeef'::bytea)
      `),
      ).resolves.not.toThrow();

      // app_rw diizinkan SELECT
      await expect(client!.query('SELECT COUNT(*) FROM audit.audit_logs')).resolves.not.toThrow();

      // app_rw DILARANG UPDATE (Permission Denied)
      await expect(client!.query("UPDATE audit.audit_logs SET action = 'hacked'")).rejects.toThrow(
        /permission denied/i,
      );

      // app_rw DILARANG DELETE (Permission Denied)
      await expect(client!.query('DELETE FROM audit.audit_logs')).rejects.toThrow(
        /permission denied/i,
      );

      // Kembalikan role ke superuser
      await client!.query('RESET ROLE;');
    },
  );
});
