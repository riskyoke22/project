# DEPLOYMENT PROCEDURE — MagangHub MVP

> Prosedur deployment MagangHub MVP ke VPS `192.168.120.198`.
> Prasyarat: SSH access ke VPS sudah tersedia.
> Diperbarui: 2026-11-19

---

## 1. INFORMASI VPS

| Item     | Nilai                |
| -------- | -------------------- |
| IP       | `192.168.120.198`    |
| User SSH | `magang`             |
| Path VPS | `/var/www/webmagang` |
| OS       | Ubuntu               |
| Node.js  | v24.22.3             |
| pnpm     | 9.15.4               |

---

## 2. FILE YANG PERLU DIPINDAHKAN

### File yang berubah (dari lokal ke VPS):

**Backend (API):**

```
apps/api/src/app.module.ts
apps/api/src/modules/guest/guest.module.ts
apps/api/src/modules/guest/controllers/guest.controller.ts
apps/api/src/modules/guest/controllers/guest.controller.spec.ts
apps/api/src/modules/guest/services/guest.service.ts
apps/api/src/modules/guest/services/guest.service.spec.ts
apps/api/src/modules/guest/dto/create-public-visit.dto.ts
apps/api/src/modules/guest/infrastructure/schema.ts
apps/api/tsconfig.json
apps/api/tsconfig.build.json
```

**Frontend (Web):**

```
apps/web/src/app/layout.tsx
apps/web/src/app/page.tsx
apps/web/src/app/page.spec.tsx
apps/web/src/app/buku-tamu/page.tsx
apps/web/src/lib/api.ts
```

**Database:**

```
db/migrations/0009_guest_host_name.sql
```

**Dokumentasi:**

```
docs/LAUNCH-STATUS.md
docs/DEPLOYMENT-PROCEDURE.md
```

**File yang sudah diperbaiki sebelumnya (sudah ada di VPS — verifikasi saja):**

```
apps/api/src/common/audit/audit.service.ts
apps/api/src/common/audit/audit.service.spec.ts
apps/api/src/common/auth/route-security-scanner.spec.ts
apps/api/src/common/crypto/crypto.service.spec.ts
apps/api/src/common/crypto/crypto.service.ts
apps/api/src/common/errors/app-error.ts
apps/api/src/common/errors/global-exception.filter.spec.ts
apps/api/src/common/security/csrf.middleware.ts
```

---

## 3. FILE YANG PERLU DI-BACKUP DI VPS

Sebelum deployment, backup file berikut di VPS:

```bash
# Di VPS, buat direktori backup
mkdir -p /var/www/webmagang-backup-$(date +%Y%m%d)

# Backup seluruh repo
cp -r /var/www/webmagang /var/www/webmagang-backup-$(date +%Y%m%d)/

# Backup .env
cp /var/www/webmagang/.env /var/www/webmagang-backup-$(date +%Y%m%d)/.env.backup

# Backup database (pg_dump)
pg_dump -U postgres sistem_db > /var/www/webmagang-backup-$(date +%Y%m%d)/sistem_db_backup.sql
```

---

## 4. DEPENDENCY YANG DIBUTUHKAN

### Backend

- Node.js >= 20 (VPS: v24.22.3)
- pnpm >= 9 (VPS: 9.15.4)
- PostgreSQL 17+
- Redis 7+
- MinIO (untuk file storage)

### Frontend

- Node.js >= 20
- pnpm >= 9

### Package tambahan yang mungkin perlu install

Tidak ada package baru yang ditambahkan. Semua dependency sudah ada di `package.json`.

---

## 5. ENVIRONMENT VARIABLE YANG DIBUTUHKAN

File `.env` di VPS harus berisi (nilai disensor, sesuaikan dengan VPS):

```env
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

DATABASE_URL=postgresql://postgres:****@127.0.0.1:5432/sistem_db
REDIS_URL=redis://127.0.0.1:6379

MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=****
MINIO_SECRET_KEY=****
MINIO_BUCKET_NAME=sistem-terintegrasi-files

APP_SECRET=**** (minimal 32 karakter)
BLIND_INDEX_SALT=****
JWT_ACCESS_SECRET=****
JWT_REFRESH_SECRET=****

# PENTING: Tambahkan origin VPS untuk CORS
CORS_ORIGINS=http://192.168.120.198,http://localhost:3000

# Frontend API URL (same-origin via reverse proxy)
NEXT_PUBLIC_API_URL=http://192.168.120.198/api
```

### Variabel yang PERLU DISESUAIKAN dari yang sekarang:

1. `CORS_ORIGINS` — tambahkan `http://192.168.120.198`
2. `NEXT_PUBLIC_API_URL` — ubah ke `http://192.168.120.198/api`

---

## 6. PORT APLIKASI

| Service                     | Port | Binding                      |
| --------------------------- | ---- | ---------------------------- |
| Backend API (NestJS)        | 4000 | `0.0.0.0` (sudah di main.ts) |
| Frontend Web (Next.js)      | 3000 | `0.0.0.0` (default Next.js)  |
| PostgreSQL                  | 5432 | `127.0.0.1`                  |
| Redis                       | 6379 | `127.0.0.1`                  |
| MinIO S3                    | 9000 | `127.0.0.1`                  |
| MinIO Console               | 9001 | `127.0.0.1`                  |
| Reverse Proxy (Nginx/Caddy) | 80   | `0.0.0.0` (untuk LAN access) |

---

## 7. KONFIGURASI REVERSE PROXY

### Opsi A: Nginx (Jika VPS menggunakan Nginx)

Buat/edit `/etc/nginx/sites-available/maganghub`:

```nginx
server {
    listen 80;
    server_name 192.168.120.198;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend Web
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Opsi B: Caddy (Jika VPS menggunakan Caddy dari docker-compose)

Edit `infra/caddy/Caddyfile`, ubah binding dari `127.0.0.1` ke `0.0.0.0`:

```caddy
http://192.168.120.198 {
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
        -X-Powered-By
    }

    handle /api/* {
        uri strip_prefix /api
        reverse_proxy api:4000
    }

    handle {
        reverse_proxy web:3000
    }
}
```

Juga ubah `docker-compose.yml` ports untuk Caddy:

```yaml
ports:
  - '0.0.0.0:80:80'
```

---

## 8. CARA MENJALANKAN APLIKASI

### Opsi A: PM2 (Direct di VPS)

```bash
# SSH ke VPS
ssh magang@192.168.120.198

# Pindah ke direktori proyek
cd /var/www/webmagang

# Install dependencies
pnpm install --frozen-lockfile

# Build backend
pnpm --filter @sistem-terintegrasi/api run build

# Build frontend
pnpm --filter @sistem-terintegrasi/web run build

# Jalankan database migration (termasuk 0009 baru)
pnpm db:migrate

# Jalankan dengan PM2
pm2 start "node apps/api/dist/main.js" --name maganghub-api
pm2 start "pnpm --filter @sistem-terintegrasi/web run start" --name maganghub-web

# Simpan konfigurasi PM2
pm2 save

# Setup PM2 startup (auto-restart setelah reboot)
pm2 startup
```

### Opsi B: Docker Compose

```bash
ssh magang@192.168.120.198
cd /var/www/webmagang/infra

# Build dan jalankan
docker compose up -d --build

# Cek status
docker compose ps
```

---

## 9. CARA MEMERIKSA LOG

### PM2

```bash
pm2 logs maganghub-api --lines 50
pm2 logs maganghub-web --lines 50
```

### Docker Compose

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f caddy
```

### Systemd (jika menggunakan systemd)

```bash
journalctl -u maganghub-api -f
journalctl -u maganghub-web -f
```

---

## 10. CARA ROLLBACK

### Rollback Aplikasi (kode)

```bash
# Stop aplikasi
pm2 stop maganghub-api maganghub-web

# Restore dari backup
cp -r /var/www/webmagang-backup-YYYYMMDD/* /var/www/webmagang/

# Restart aplikasi
pm2 start maganghub-api maganghub-web
```

### Rollback Database Migration 0009

Migration 0009 hanya menambahkan kolom nullable. Jika perlu rollback:

```bash
# Login ke PostgreSQL
psql -U postgres sistem_db

# Rollback (hapus kolom yang ditambahkan)
ALTER TABLE guest.visits DROP COLUMN IF EXISTS host_employee_name;
ALTER TABLE guest.visits DROP COLUMN IF EXISTS host_org_unit_name;

# Hapus record migrasi
DELETE FROM core.__migrations WHERE name = '0009_guest_host_name.sql';
```

### Rollback Docker Compose

```bash
cd /var/www/webmagang/infra
docker compose down
# Restore backup
cp -r /var/www/webmagang-backup-YYYYMMDD/* /var/www/webmagang/
docker compose up -d
```

---

## 11. VERIFIKASI SETELAH DEPLOYMENT

```bash
# 1. Cek health endpoint
curl http://192.168.120.198/api/health

# 2. Cek ready endpoint
curl http://192.168.120.198/api/ready

# 3. Test Buku Tamu endpoint
curl -X POST http://192.168.120.198/api/guest/visits \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","purpose":"Test Visit","hostEmployeeName":"Test Host","partySize":1}'

# 4. Cek frontend
curl -s http://192.168.120.198 | head -20

# 5. Cek Buku Tamu page
curl -s http://192.168.120.198/buku-tamu | head -20

# 6. Cek dari browser lain di LAN
# Buka: http://192.168.120.198
# Buka: http://192.168.120.198/buku-tamu
```

---

## 12. PERINTAH POWERSHELL UNTUK MEMINDAHKAN PERUBAHAN KE VPS

Jalankan perintah berikut dari Windows PowerShell (sesuaikan path jika berbeda):

```powershell
# Variabel
$VPS_HOST = "192.168.120.198"
$VPS_USER = "magang"
$VPS_PATH = "/var/www/webmagang"
$LOCAL_PATH = "D:\MAGANGHUB\WEBB"

# 1. Backup VPS terlebih dahulu (via SSH)
ssh ${VPS_USER}@${VPS_HOST} "mkdir -p /var/www/webmagang-backup-$(date +%Y%m%d) && cp -r ${VPS_PATH} /var/www/webmagang-backup-$(date +%Y%m%d)/ && pg_dump -U postgres sistem_db > /var/www/webmagang-backup-$(date +%Y%m%d)/sistem_db_backup.sql"

# 2. Salin file backend yang berubah
scp ${LOCAL_PATH}\apps\api\src\app.module.ts ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/api/src/
scp ${LOCAL_PATH}\apps\api\src\modules\guest\guest.module.ts ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/api/src/modules/guest/
scp -r ${LOCAL_PATH}\apps\api\src\modules\guest\controllers ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/api/src/modules/guest/
scp -r ${LOCAL_PATH}\apps\api\src\modules\guest\dto ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/api/src/modules/guest/
scp -r ${LOCAL_PATH}\apps\api\src\modules\guest\services ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/api/src/modules/guest/
scp ${LOCAL_PATH}\apps\api\src\modules\guest\infrastructure\schema.ts ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/api/src/modules/guest/infrastructure/
scp ${LOCAL_PATH}\apps\api\tsconfig.json ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/api/
scp ${LOCAL_PATH}\apps\api\tsconfig.build.json ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/api/

# 3. Salin file frontend yang berubah
scp ${LOCAL_PATH}\apps\web\src\app\layout.tsx ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/web/src/app/
scp ${LOCAL_PATH}\apps\web\src\app\page.tsx ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/web/src/app/
scp ${LOCAL_PATH}\apps\web\src\app\page.spec.tsx ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/web/src/app/
scp ${LOCAL_PATH}\apps\web\src\lib\api.ts ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/web/src/lib/

# 4. Buat direktori buku-tamu dan salin
ssh ${VPS_USER}@${VPS_HOST} "mkdir -p ${VPS_PATH}/apps/web/src/app/buku-tamu"
scp ${LOCAL_PATH}\apps\web\src\app\buku-tamu\page.tsx ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/apps/web/src/app/buku-tamu/

# 5. Salin migration baru
scp ${LOCAL_PATH}\db\migrations\0009_guest_host_name.sql ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/db/migrations/

# 6. Salin dokumentasi
scp ${LOCAL_PATH}\docs\LAUNCH-STATUS.md ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/docs/
scp ${LOCAL_PATH}\docs\DEPLOYMENT-PROCEDURE.md ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/docs/

# 7. SSH ke VPS, install dependencies, build, migrate, restart
ssh ${VPS_USER}@${VPS_HOST} "cd ${VPS_PATH} && pnpm install --frozen-lockfile && pnpm --filter @sistem-terintegrasi/api run build && pnpm --filter @sistem-terintegrasi/web run build && pnpm db:migrate"

# 8. Restart aplikasi (PM2)
ssh ${VPS_USER}@${VPS_HOST} "pm2 restart maganghub-api maganghub-web"

# 9. Verifikasi
ssh ${VPS_USER}@${VPS_HOST} "curl -s http://127.0.0.1:4000/ready"
ssh ${VPS_USER}@${VPS_HOST} "curl -s http://127.0.0.1:3000 | head -5"
```

**CATATAN:** Perintah di atas akan gagal jika SSH access belum tersedia.
Pastikan public key sudah terdaftar di VPS `authorized_keys` sebelum menjalankan.

---

## 13. CHECKLIST DEPLOYMENT

- [ ] SSH access ke VPS tersedia
- [ ] Backup VPS (file + database) selesai
- [ ] File perubahan disalin ke VPS
- [ ] `pnpm install --frozen-lockfile` berhasil
- [ ] Backend build berhasil (`tsc -p tsconfig.build.json`)
- [ ] Frontend build berhasil (`next build`)
- [ ] Database migration berhasil (`pnpm db:migrate`)
- [ ] `.env` diperbarui (CORS_ORIGINS, NEXT_PUBLIC_API_URL)
- [ ] Reverse proxy dikonfigurasi (Nginx/Caddy)
- [ ] Aplikasi dijalankan (PM2/Docker)
- [ ] Health endpoint merespons (`/api/health`)
- [ ] Frontend dapat diakses dari LAN (`http://192.168.120.198`)
- [ ] Buku Tamu form berfungsi (`http://192.168.120.198/buku-tamu`)
- [ ] PM2 startup/save dikonfigurasi (auto-restart setelah reboot)
