import { Injectable, Optional } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { AppConfigService } from '../config/env.config';
import { DatabaseError } from '../errors/app-error';

export type TransactionalWork<T> = (client: PoolClient) => Promise<T>;

/**
 * TransactionManager & Unit of Work Helper.
 * Memastikan use case dapat memulai transaksi bisnis melintasi beberapa repository,
 * dan seluruh operasi di-commit atau di-rollback secara atomik (ACID).
 */
@Injectable()
export class TransactionManager {
  private pool: Pool | null = null;

  constructor(@Optional() private readonly config?: AppConfigService) {
    if (this.config) {
      this.pool = new Pool({
        connectionString: this.config.get('DATABASE_URL'),
      });
    }
  }

  /**
   * Menjalankan fungsi pekerjaan dalam satu transaksi PostgreSQL atomik.
   * - Melakukan BEGIN sebelum pekerjaan dimulai.
   * - Melakukan COMMIT jika pekerjaan sukses tanpa galat.
   * - Melakukan ROLLBACK otomatis jika terjadi pengecualian/galat apapun.
   * - Mengembalikan koneksi PoolClient ke pool di blok finally.
   */
  public async runInTransaction<T>(
    work: TransactionalWork<T>,
    customClient?: PoolClient,
  ): Promise<T> {
    // Jika sudah di dalam client transaksi eksisting, gunakan client tersebut (nested/joined)
    if (customClient) {
      return work(customClient);
    }

    if (!this.pool) {
      throw new DatabaseError(
        'Koneksi database pool belum terinisialisasi pada TransactionManager.',
        'DB_POOL_NOT_INITIALIZED',
      );
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // Abaikan galat rollback sekunder dan pertahankan galat utama
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /** Mendapatkan pool database mentah untuk query non-transaksional */
  public getPool(): Pool | null {
    return this.pool;
  }

  /** Menutup pool koneksi (misal saat shutdown aplikasi) */
  public async onApplicationShutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
