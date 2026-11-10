import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { PERMISSION_SEEDS } from '../db/seeds/permissions.seed';
import { ROLE_SEEDS } from '../db/seeds/roles.seed';
import { REFERENCE_DATA_SEEDS } from '../db/seeds/reference_data.seed';

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

export async function runSeeds(customClient?: Client): Promise<void> {
  const client = customClient || new Client({ connectionString: getDatabaseUrl() });
  const shouldClose = !customClient;

  if (shouldClose) {
    await client.connect();
  }

  try {
    console.log('[SEED] Memulai proses seeding idempoten...');

    await client.query('BEGIN');

    // 1. Seed Permissions (core.permissions)
    console.log(`[SEED] Seeding ${PERMISSION_SEEDS.length} izin ke core.permissions...`);
    for (const perm of PERMISSION_SEEDS) {
      await client.query(
        `INSERT INTO core.permissions (code, module, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET
           module = EXCLUDED.module,
           description = EXCLUDED.description`,
        [perm.code, perm.module, perm.description],
      );
    }

    // 2. Seed Roles (core.roles)
    console.log(`[SEED] Seeding ${ROLE_SEEDS.length} peran bawaan ke core.roles...`);
    for (const role of ROLE_SEEDS) {
      await client.query(
        `INSERT INTO core.roles (code, name, description, is_system)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_system = EXCLUDED.is_system`,
        [role.code, role.name, role.description, role.isSystem],
      );
    }

    // Ambil mapping role_id dan permission_id
    const rolesResult = await client.query('SELECT id, code FROM core.roles');
    const roleIdMap = new Map<string, string>();
    for (const r of rolesResult.rows) {
      roleIdMap.set(r.code, r.id);
    }

    const permsResult = await client.query('SELECT id, code FROM core.permissions');
    const permIdMap = new Map<string, string>();
    for (const p of permsResult.rows) {
      permIdMap.set(p.code, p.id);
    }

    // 3. Seed Pemetaan Role -> Permissions (core.role_permissions)
    console.log('[SEED] Menghubungkan relasi peran dan izin (core.role_permissions)...');
    for (const role of ROLE_SEEDS) {
      const roleId = roleIdMap.get(role.code);
      if (!roleId) continue;

      for (const permCode of role.permissionCodes) {
        const permId = permIdMap.get(permCode);
        if (!permId) continue;

        await client.query(
          `INSERT INTO core.role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [roleId, permId],
        );
      }
    }

    // 4. Seed Data Referensi HR: employment_statuses
    console.log('[SEED] Seeding data referensi hr.employment_statuses...');
    for (const item of REFERENCE_DATA_SEEDS.employmentStatuses) {
      await client.query(
        `INSERT INTO hr.employment_statuses (code, name)
         VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
        [item.code, item.name],
      );
    }

    // 5. Seed Data Referensi HR: grades
    console.log('[SEED] Seeding data referensi hr.grades...');
    for (const item of REFERENCE_DATA_SEEDS.grades) {
      await client.query(
        `INSERT INTO hr.grades (code, name, rank_level)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           rank_level = EXCLUDED.rank_level`,
        [item.code, item.name, item.rankLevel],
      );
    }

    // 6. Seed Data Referensi HR: leave_types
    console.log('[SEED] Seeding data referensi hr.leave_types...');
    for (const item of REFERENCE_DATA_SEEDS.leaveTypes) {
      await client.query(
        `INSERT INTO hr.leave_types (code, name, annual_quota_days, requires_attachment, is_paid)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           annual_quota_days = EXCLUDED.annual_quota_days,
           requires_attachment = EXCLUDED.requires_attachment,
           is_paid = EXCLUDED.is_paid`,
        [item.code, item.name, item.annualQuotaDays, item.requiresAttachment, item.isPaid],
      );
    }

    // 7. Seed Data Referensi PERF: behavior_aspects
    console.log('[SEED] Seeding data referensi perf.behavior_aspects...');
    for (const item of REFERENCE_DATA_SEEDS.behaviorAspects) {
      await client.query(
        `INSERT INTO perf.behavior_aspects (code, name, weight)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           weight = EXCLUDED.weight`,
        [item.code, item.name, item.weight],
      );
    }

    // 8. Seed Data Referensi ARCHIVE: categories
    console.log('[SEED] Seeding data referensi archive.categories...');
    for (const item of REFERENCE_DATA_SEEDS.archiveCategories) {
      await client.query(
        `INSERT INTO archive.categories (code, name, active_retention_years, inactive_retention_years, final_disposition)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           active_retention_years = EXCLUDED.active_retention_years,
           inactive_retention_years = EXCLUDED.inactive_retention_years,
           final_disposition = EXCLUDED.final_disposition`,
        [
          item.code,
          item.name,
          item.activeRetentionYears,
          item.inactiveRetentionYears,
          item.finalDisposition,
        ],
      );
    }

    await client.query('COMMIT');
    console.log('[SEED] ✅ Seeding database selesai secara idempoten.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SEED] ❌ Gagal saat melakukan seeding database:', err);
    throw err;
  } finally {
    if (shouldClose) {
      await client.end();
    }
  }
}

if (require.main === module) {
  runSeeds()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
