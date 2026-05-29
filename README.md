# Registration Scanner Cloud

Cloud-hosted registration scanner system built with Next.js + Supabase.

## Features

- Admin login with Supabase Auth
- Upload Excel/CSV dataset and activate it
- Dynamic stations from uploaded columns
- Share station-specific scanner links
- Staff QR/manual scan flow with eligibility checks
- Registration-first gate support
- Download final workbook export
- Scan logs + admin audit logs

## Tech Stack

- Next.js App Router
- Supabase (Postgres + Auth)
- Vercel-ready deployment
- `xlsx` for Excel parsing/export
- `html5-qrcode` for camera scanning

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env vars:

```bash
cp .env.example .env.local
```

3. Fill these in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (example: `http://localhost:3000`)

4. Apply DB schema:

- Open Supabase SQL editor
- Run `supabase/schema.sql`

5. Start app:

```bash
npm run dev
```

6. Open:

- `/login` for admin login
- `/admin` for dashboard

The first authenticated user who logs in gets auto-bootstrapped as `admin` role (if no profiles exist yet).

## Deployment (Vercel)

1. Push this folder to GitHub.
2. Import repo in Vercel.
3. Set same environment variables in Vercel project settings.
4. Deploy.
5. Set `NEXT_PUBLIC_APP_URL` to your production URL.

## Data Model (High Level)

- `organizations`
- `profiles` (auth user + role)
- `datasets` (active dataset config)
- `stations`
- `delegates`
- `delegate_station_status`
- `scan_logs`
- `admin_audit_logs`
