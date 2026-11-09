import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from './page';
import React from 'react';

describe('Web App Homepage Placeholder', () => {
  it('harus merender judul dan 4 kartu modul utama', () => {
    render(<HomePage />);

    expect(screen.getByText('Portal Layanan Terintegrasi')).toBeDefined();
    expect(screen.getByText('Buku Tamu')).toBeDefined();
    expect(screen.getByText('Kepegawaian (HR)')).toBeDefined();
    expect(screen.getByText('Kinerja Pegawai')).toBeDefined();
    expect(screen.getByText('Arsip & Dokumen')).toBeDefined();
  });
});
