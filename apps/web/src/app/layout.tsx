import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MagangHub - Portal Sistem Informasi Terintegrasi',
  description:
    'Platform layanan terintegrasi: Buku Tamu, Kepegawaian, Kinerja, dan Arsip dengan keamanan tinggi.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
