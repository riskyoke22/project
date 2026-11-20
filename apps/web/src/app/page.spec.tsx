import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from './page';
import React from 'react';

describe('Web App Homepage', () => {
  it('harus merender judul MagangHub dan kartu modul utama', () => {
    render(<HomePage />);

    expect(screen.getByText('Portal MagangHub')).toBeDefined();
    // Module names appear in multiple places (navbar, cards, status rows)
    expect(screen.getAllByText('Buku Tamu').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Kepegawaian (HR)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Kinerja Pegawai').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Arsip & Dokumen').length).toBeGreaterThanOrEqual(1);
  });

  it('harus menampilkan status implementasi yang jujur', () => {
    render(<HomePage />);

    expect(screen.getAllByText('Dalam Pengembangan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Skema Database Siap').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Belum Dimulai').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Framework Siap').length).toBeGreaterThanOrEqual(1);
  });
});
