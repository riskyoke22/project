import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  FileText,
  CalendarCheck,
  BarChart3,
  ShieldCheck,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

const modules = [
  {
    title: 'Buku Tamu',
    description:
      'Pencatatan kunjungan tamu, janji temu, dan pengelolaan lencana kunjungan organisasi.',
    icon: CalendarCheck,
    status: 'Tersedia',
    statusColor: 'text-green-600 bg-green-50',
    href: '/buku-tamu',
    available: true,
  },
  {
    title: 'Kepegawaian (HR)',
    description: 'Data master pegawai, riwayat jabatan, riwayat pendidikan, dan pengajuan cuti.',
    icon: Users,
    status: 'Dalam Pengembangan',
    statusColor: 'text-amber-600 bg-amber-50',
    href: null,
    available: false,
  },
  {
    title: 'Kinerja Pegawai',
    description: 'Siklus evaluasi SKP/kinerja, target sasaran kerja, dan rekap penilaian berkala.',
    icon: BarChart3,
    status: 'Dalam Pengembangan',
    statusColor: 'text-amber-600 bg-amber-50',
    href: null,
    available: false,
  },
  {
    title: 'Arsip & Dokumen',
    description: 'Manajemen naskah dinas, penomoran otomatis, disposisi, dan jadwal retensi arsip.',
    icon: FileText,
    status: 'Dalam Pengembangan',
    statusColor: 'text-amber-600 bg-amber-50',
    href: null,
    available: false,
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: 'Keamanan Berlapis',
    description:
      'Enkripsi AES-256-GCM, hashing Argon2id, RBAC deny-by-default, dan audit trail dengan hash chain.',
  },
  {
    icon: Building2,
    title: 'Terintegrasi',
    description:
      'Satu platform untuk Buku Tamu, Kepegawaian, Kinerja, dan Arsip dengan basis data terpusat.',
  },
  {
    icon: Clock,
    title: 'Pelacakan Kunjungan',
    description:
      'Pencatatan kunjungan tamu secara real-time dengan data terenkripsi dan retensi terkontrol.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              M
            </div>
            <span className="text-lg font-bold tracking-tight">MagangHub</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#modul"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Modul
            </a>
            <a
              href="#fitur"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Fitur
            </a>
            <a
              href="#status"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Status
            </a>
          </nav>
          <Link href="/buku-tamu">
            <Button size="sm">Buku Tamu</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
              <ShieldCheck className="w-3.5 h-3.5" />
              Sistem Informasi Terintegrasi Organisasi
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Portal MagangHub
            </h1>
            <p className="max-w-2xl text-muted-foreground text-lg md:text-xl">
              Platform layanan terintegrasi untuk pencatatan kunjungan, manajemen kepegawaian,
              kinerja pegawai, dan arsip dokumen dengan standar keamanan tinggi.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link href="/buku-tamu">
                <Button size="lg" className="w-full sm:w-auto">
                  Catat Kunjungan
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <a href="#modul">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Lihat Modul
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fitur" className="border-y bg-slate-50/50">
        <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Mengapa MagangHub?</h2>
            <p className="mt-2 text-muted-foreground">
              Dibangun dengan prinsip keamanan ketat dan privasi data di setiap lapisan.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex flex-col items-center text-center p-6 rounded-xl border bg-white"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Module Cards Section */}
      <section id="modul" className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Modul Sistem</h2>
          <p className="mt-2 text-muted-foreground">
            Setiap modul dikembangkan secara bertahap dengan validasi dan otorisasi yang ketat.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Card
                key={mod.title}
                className={`flex flex-col hover:shadow-md transition-shadow ${
                  mod.available ? 'border-primary/30' : 'opacity-90'
                }`}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      {mod.title}
                      {mod.available && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    </CardTitle>
                    <CardDescription>{mod.description}</CardDescription>
                  </div>
                  <div className="ml-4 flex-shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                </CardHeader>
                <CardContent className="mt-auto pt-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md ${mod.statusColor}`}
                    >
                      {mod.available ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      {mod.status}
                    </span>
                    {mod.available && mod.href ? (
                      <Link href={mod.href}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary"
                        >
                          Buka
                          <ArrowRight className="ml-1 w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Implementation Status Section */}
      <section id="status" className="border-t bg-slate-50/50">
        <div className="container mx-auto max-w-4xl px-4 py-12 md:py-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Status Implementasi</h2>
            <p className="mt-2 text-muted-foreground">
              Transparansi status pengembangan setiap modul.
            </p>
          </div>
          <div className="space-y-3">
            <StatusRow label="Buku Tamu - Pendaftaran Kunjungan" status="Tersedia" available />
            <StatusRow label="Buku Tamu - Manajemen Data (Admin)" status="Dalam Pengembangan" />
            <StatusRow label="Kepegawaian (HR)" status="Skema Database Siap" />
            <StatusRow label="Kinerja Pegawai" status="Skema Database Siap" />
            <StatusRow label="Arsip & Dokumen" status="Skema Database Siap" />
            <StatusRow label="Autentikasi & Login" status="Dalam Pengembangan" />
            <StatusRow label="Dashboard Admin" status="Belum Dimulai" />
            <StatusRow label="Manajemen Pengguna (RBAC)" status="Framework Siap" />
            <StatusRow label="Audit Log" status="Framework Siap" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs">
                M
              </div>
              <span className="font-semibold text-sm">MagangHub</span>
            </div>
            <p className="text-xs text-muted-foreground text-center md:text-right">
              Sistem Informasi Terintegrasi &copy; {new Date().getFullYear()} &bull; Dalam
              Pengembangan MVP
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatusRow({
  label,
  status,
  available = false,
}: {
  label: string;
  status: string;
  available?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-md ${
          available ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
        }`}
      >
        {available ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
        {status}
      </span>
    </div>
  );
}
