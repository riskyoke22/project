'use client';

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { apiPost, type ApiResult } from '@/lib/api';

interface GuestVisitResponse {
  id: string;
  checkInAt: string;
}

type FormState = {
  fullName: string;
  organization: string;
  purpose: string;
  hostEmployeeName: string;
  hostOrgUnit: string;
  partySize: string;
  phone: string;
  email: string;
};

const initialState: FormState = {
  fullName: '',
  organization: '',
  purpose: '',
  hostEmployeeName: '',
  hostOrgUnit: '',
  partySize: '1',
  phone: '',
  email: '',
};

const errors_t: Record<string, string> = {};

export default function BukuTamuPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [consentGiven, setConsentGiven] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>(errors_t);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApiResult<GuestVisitResponse> | null>(null);

  const validate = useCallback((data: FormState, consent: boolean): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!data.fullName.trim()) e.fullName = 'Nama lengkap wajib diisi.';
    if (data.fullName.trim().length > 200) e.fullName = 'Nama terlalu panjang (maks 200 karakter).';
    if (!data.purpose.trim()) e.purpose = 'Tujuan kunjungan wajib diisi.';
    if (data.purpose.trim().length > 500) e.purpose = 'Tujuan terlalu panjang (maks 500 karakter).';
    if (!data.hostEmployeeName.trim()) e.hostEmployeeName = 'Nama yang dikunjungi wajib diisi.';
    if (data.hostEmployeeName.trim().length > 200)
      e.hostEmployeeName = 'Nama terlalu panjang (maks 200 karakter).';
    const partySizeNum = parseInt(data.partySize, 10);
    if (isNaN(partySizeNum) || partySizeNum < 1 || partySizeNum > 50)
      e.partySize = 'Jumlah peserta harus antara 1-50.';
    if (data.phone && data.phone.trim().length > 20) e.phone = 'Nomor telepon terlalu panjang.';
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      e.email = 'Format email tidak valid.';
    if (data.organization && data.organization.trim().length > 200)
      e.organization = 'Nama instansi terlalu panjang.';
    if (!consent) e.consent = 'Persetujuan pemrosesan data pribadi wajib disetujui.';
    return e;
  }, []);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const validationErrors = validate(form, consentGiven);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setResult(null);

    const payload = {
      fullName: form.fullName.trim(),
      organization: form.organization.trim() || undefined,
      purpose: form.purpose.trim(),
      hostEmployeeName: form.hostEmployeeName.trim(),
      hostOrgUnitName: form.hostOrgUnit.trim() || undefined,
      partySize: parseInt(form.partySize, 10),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      consentGiven,
    };

    const res = await apiPost<GuestVisitResponse>('/guest/visits', payload);
    setResult(res);
    setSubmitting(false);

    if (res.success) {
      setForm(initialState);
      setConsentGiven(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Beranda
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs">
              M
            </div>
            <span className="font-semibold text-sm">MagangHub</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8 md:py-12">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Buku Tamu</h1>
          <p className="mt-2 text-muted-foreground">
            Silakan isi data kunjungan Anda di bawah ini.
          </p>
        </div>

        {/* Success Message */}
        {result && result.success && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900">Kunjungan berhasil dicatat.</p>
                  <p className="text-sm text-green-700 mt-1">
                    Terima kasih telah mengisi buku tamu. Data kunjungan Anda telah tersimpan dengan
                    aman.
                  </p>
                  {result.data?.checkInAt && (
                    <p className="text-xs text-green-600 mt-2">
                      Waktu check-in: {new Date(result.data.checkInAt).toLocaleString('id-ID')}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {result && !result.success && (
          <Card className="mb-6 border-destructive/20 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">Gagal mencatat kunjungan.</p>
                  <p className="text-sm text-destructive/80 mt-1">
                    {result.error?.message || 'Terjadi kesalahan. Silakan coba lagi.'}
                  </p>
                  {result.error?.code && (
                    <p className="text-xs text-destructive/60 mt-2">
                      Kode error: {result.error.code}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Formulir Kunjungan</CardTitle>
            <CardDescription>
              Data kunjungan Anda disimpan dengan aman. Data kontak opsional (telepon, email) akan
              digunakan hanya untuk keperluan administrasi kunjungan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Nama Lengkap */}
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="text-sm font-medium">
                  Nama Lengkap <span className="text-destructive">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={form.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring ${
                    errors.fullName ? 'border-destructive' : 'border-input'
                  }`}
                  placeholder="Masukkan nama lengkap Anda"
                  maxLength={200}
                  disabled={submitting}
                  aria-invalid={!!errors.fullName}
                />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
              </div>

              {/* Instansi */}
              <div className="space-y-1.5">
                <label htmlFor="organization" className="text-sm font-medium">
                  Instansi / Organisasi
                </label>
                <input
                  id="organization"
                  type="text"
                  value={form.organization}
                  onChange={(e) => handleChange('organization', e.target.value)}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Nama instansi atau organisasi Anda"
                  maxLength={200}
                  disabled={submitting}
                />
              </div>

              {/* Tujuan Kunjungan */}
              <div className="space-y-1.5">
                <label htmlFor="purpose" className="text-sm font-medium">
                  Tujuan Kunjungan <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="purpose"
                  value={form.purpose}
                  onChange={(e) => handleChange('purpose', e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-y min-h-[80px] ${
                    errors.purpose ? 'border-destructive' : 'border-input'
                  }`}
                  placeholder="Jelaskan tujuan kunjungan Anda"
                  maxLength={500}
                  disabled={submitting}
                  aria-invalid={!!errors.purpose}
                />
                {errors.purpose && <p className="text-xs text-destructive">{errors.purpose}</p>}
              </div>

              {/* Yang Dikunjungi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="hostEmployeeName" className="text-sm font-medium">
                    Nama yang Dikunjungi <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="hostEmployeeName"
                    type="text"
                    value={form.hostEmployeeName}
                    onChange={(e) => handleChange('hostEmployeeName', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring ${
                      errors.hostEmployeeName ? 'border-destructive' : 'border-input'
                    }`}
                    placeholder="Nama pegawai yang dikunjungi"
                    maxLength={200}
                    disabled={submitting}
                    aria-invalid={!!errors.hostEmployeeName}
                  />
                  {errors.hostEmployeeName && (
                    <p className="text-xs text-destructive">{errors.hostEmployeeName}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="hostOrgUnit" className="text-sm font-medium">
                    Bagian / Unit
                  </label>
                  <input
                    id="hostOrgUnit"
                    type="text"
                    value={form.hostOrgUnit}
                    onChange={(e) => handleChange('hostOrgUnit', e.target.value)}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Bagian atau unit yang dituju"
                    maxLength={200}
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Jumlah Peserta */}
              <div className="space-y-1.5">
                <label htmlFor="partySize" className="text-sm font-medium">
                  Jumlah Peserta <span className="text-destructive">*</span>
                </label>
                <input
                  id="partySize"
                  type="number"
                  value={form.partySize}
                  onChange={(e) => handleChange('partySize', e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-32 ${
                    errors.partySize ? 'border-destructive' : 'border-input'
                  }`}
                  min={1}
                  max={50}
                  disabled={submitting}
                  aria-invalid={!!errors.partySize}
                />
                {errors.partySize && <p className="text-xs text-destructive">{errors.partySize}</p>}
              </div>

              {/* Kontak (opsional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="text-sm font-medium">
                    Nomor Telepon
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring ${
                      errors.phone ? 'border-destructive' : 'border-input'
                    }`}
                    placeholder="08xxxxxxxxxx"
                    maxLength={20}
                    disabled={submitting}
                    aria-invalid={!!errors.phone}
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring ${
                      errors.email ? 'border-destructive' : 'border-input'
                    }`}
                    placeholder="nama@email.com"
                    disabled={submitting}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>

              {/* Persetujuan Data Pribadi */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => {
                      setConsentGiven(e.target.checked);
                      if (errors.consent) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.consent;
                          return next;
                        });
                      }
                    }}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    disabled={submitting}
                  />
                  <span>
                    Saya menyetujui data kunjungan saya dicatat dan diproses untuk keperluan
                    administrasi dan keamanan kunjungan. <span className="text-destructive">*</span>
                  </span>
                </label>
                {errors.consent && (
                  <p className="mt-1 text-xs text-destructive">{errors.consent}</p>
                )}
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={submitting || !consentGiven}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Kunjungan'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Note */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Data kunjungan disimpan dengan aman. Hanya administrator yang berwenang yang dapat melihat
          data lengkap.
        </p>
      </main>
    </div>
  );
}
