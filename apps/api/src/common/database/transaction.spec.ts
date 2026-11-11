import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PoolClient } from 'pg';
import { TransactionManager } from './transaction';

describe('TransactionManager (Unit of Work Pattern)', () => {
  let transactionManager: TransactionManager;
  let mockClient: PoolClient;
  let queryMock: ReturnType<typeof vi.fn>;
  let releaseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryMock = vi.fn().mockResolvedValue({ rows: [] });
    releaseMock = vi.fn();

    mockClient = {
      query: queryMock,
      release: releaseMock,
    } as unknown as PoolClient;

    transactionManager = new TransactionManager();

    // Mock internal pool
    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn(),
    };
    (transactionManager as unknown as { pool: unknown }).pool = mockPool;
  });

  it('menjalankan BEGIN, mengeksekusi operasi use case, melakukan COMMIT, dan melepaskan koneksi saat sukses', async () => {
    const result = await transactionManager.runInTransaction(async (client) => {
      await client.query("INSERT INTO hr.employees (name) VALUES ('Budi')");
      return { success: true, id: 'emp-101' };
    });

    expect(result).toEqual({ success: true, id: 'emp-101' });

    // Verifikasi urutan eksekusi SQL
    expect(queryMock).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(queryMock).toHaveBeenNthCalledWith(2, "INSERT INTO hr.employees (name) VALUES ('Budi')");
    expect(queryMock).toHaveBeenNthCalledWith(3, 'COMMIT');

    // Koneksi client wajib selalu dilepaskan kembali ke pool
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('menjalankan ROLLBACK, melepaskan koneksi, dan melempar error asli jika terjadi kegagalan di dalam use case', async () => {
    const businessError = new Error('Saldo cuti habis');

    await expect(
      transactionManager.runInTransaction(async (client) => {
        await client.query("UPDATE hr.leave_balances SET balance = balance - 5 WHERE id = 'lb-1'");
        throw businessError;
      }),
    ).rejects.toThrow('Saldo cuti habis');

    // Verifikasi ROLLBACK dipanggil setelah kegagalan
    expect(queryMock).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      "UPDATE hr.leave_balances SET balance = balance - 5 WHERE id = 'lb-1'",
    );
    expect(queryMock).toHaveBeenNthCalledWith(3, 'ROLLBACK');

    // Pastikan release tetap dipanggil meskipun terjadi error
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('menggunakan client yang sudah ada jika customClient disertakan (bergabung ke transaksi induk)', async () => {
    const existingClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const result = await transactionManager.runInTransaction(async (client) => {
      await client.query('SELECT 1');
      return 'nested-ok';
    }, existingClient);

    expect(result).toBe('nested-ok');
    // Tidak memanggil BEGIN/COMMIT tambahan karena mengikuti transaksi induk
    expect(existingClient.query).toHaveBeenCalledWith('SELECT 1');
    expect(existingClient.release).not.toHaveBeenCalled();
  });
});
