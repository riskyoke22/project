import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, FileText, CalendarCheck, BarChart3, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  const modules = [
    {
      title: 'Buku Tamu',
      description: 'Pencatatan kunjungan, janji temu, dan pengelolaan lencana tamu organisasi.',
      icon: CalendarCheck,
      badge: 'Tahap Persiapan',
    },
    {
      title: 'Kepegawaian (HR)',
      description: 'Data master pegawai, riwayat jabatan, riwayat pendidikan, dan pengajuan cuti.',
      icon: Users,
      badge: 'Tahap Persiapan',
    },
    {
      title: 'Kinerja Pegawai',
      description: 'Siklus evaluasi SKP/kinerja, target sasaran kerja, dan rekap penilaian.',
      icon: BarChart3,
      badge: 'Tahap Persiapan',
    },
    {
      title: 'Arsip & Dokumen',
      description:
        'Manajemen naskah dinas, penomoran otomatis, disposisi, dan jadwal retensi arsip.',
      icon: FileText,
      badge: 'Tahap Persiapan',
    },
  ];

  return (
    <main className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex flex-col items-center text-center space-y-4 mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
          <ShieldCheck className="w-4 h-4" />
          Sistem Terintegrasi Satu Organisasi
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Portal Layanan Terintegrasi
        </h1>
        <p className="max-w-2xl text-muted-foreground text-lg">
          Platform modular terpusat untuk Buku Tamu, Kinerja, Kepegawaian, dan Arsip dengan
          arsitektur keamanan ketat deny-by-default dan perlindungan data pribadi.
        </p>
        <div className="flex gap-4 pt-2">
          <Button variant="default">Masuk ke Portal</Button>
          <Button variant="outline">Dokumentasi Sistem</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Card key={mod.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-bold">{mod.title}</CardTitle>
                  <CardDescription>{mod.description}</CardDescription>
                </div>
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <Icon className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent>
                <span className="inline-block px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md">
                  {mod.badge}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <footer className="mt-16 text-center text-sm text-muted-foreground border-t pt-6">
        Sistem Terintegrasi &copy; {new Date().getFullYear()} &bull; Kerangka Repositori &
        Infrastruktur (Tahap 1)
      </footer>
    </main>
  );
}
