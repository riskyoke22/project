import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sistem Terintegrasi',
  description: 'Portal Layanan Terintegrasi: Buku Tamu, Kinerja, Kepegawaian, dan Arsip',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
