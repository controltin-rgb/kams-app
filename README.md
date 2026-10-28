# AMS — Asset Management and Ticket System

ระบบบริหารครุภัณฑ์และงานแจ้งซ่อม (Next.js 16, Prisma 7, PostgreSQL, BetterAuth)

## Deploy บน Vercel

1. Import repo นี้ใน Vercel (Framework: Next.js; `vercel.json` ตั้งคำสั่ง build ให้แล้ว)
2. ตั้ง Environment Variables ตาม `production.env.example`
   - `DATABASE_URL` — Neon แบบ pooled (`?sslmode=require`)
   - `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
   - `BETTER_AUTH_URL` — URL จริงของเว็บ
   - `CRON_SECRET` — `openssl rand -hex 24` (Vercel ส่งให้ cron เองเป็น Bearer)
3. รัน migration จากเครื่องด้วย Direct URL (ตัด `-pooler`): `DATABASE_URL=<direct> npx prisma migrate deploy`

ข้อจำกัดบน Vercel: อัปโหลดไฟล์แนบและหน้า Backup/Restore ใช้ไม่ได้ (ไม่มีดิสก์ถาวร / `pg_dump`)

## พัฒนาในเครื่อง

```bash
pnpm install
cp production.env.example .env
npx prisma generate && npx prisma migrate deploy && npx prisma db seed
pnpm dev
```
