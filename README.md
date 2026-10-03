# BE11 — Premium Cricket Ground Booking Platform

BE11 is a cricket ground booking and sports management platform serving Haryana and the NCR region (Faridabad and Gurgaon). It provides match booking, venue scheduling, official pricing packages, 3D jersey customization, 3D IPL-style coin toss, and admin management.

Production Domain: **[https://be11.in](https://be11.in)**  
Repository: **[https://github.com/Ayush-rajput007/be11.git](https://github.com/Ayush-rajput007/be11.git)**

---

## Architecture Overview

```text
                    ┌────────────────────────────────────────┐
                    │               Vercel                   │
                    │                                        │
                    │  Frontend Service: React 19 + Vite     │
                    │  Backend Service:  Express + Node.js   │
                    │  Vercel Services / Serverless Routes   │
                    └───────────────────┬────────────────────┘
                                        │
                                  API / Services
                                        │
                            PostgreSQL Database
                     (Supabase / Neon / Railway / RDS)
```

### Monorepo Structure

```text
be11/
├── frontend/             # React 19 + Vite client application
│   ├── src/              # UI components, pages, hooks, state
│   ├── public/           # Production assets (audio, 3D models, venue media)
│   ├── package.json      # Frontend dependencies & build scripts
│   └── vercel.json       # SPA client-side routing rewrites (/index.html)
├── backend/              # Express API server (Node.js + TypeScript)
│   ├── src/              # Modules (auth, bookings, grounds, admin, etc.)
│   ├── prisma/           # Prisma schema (PostgreSQL) & seed scripts
│   ├── package.json      # Backend dependencies & build scripts
│   └── tsconfig.json     # Backend TypeScript configuration
├── shared/               # Common TypeScript schemas, enums, DTOs (@be11/shared)
│   ├── index.ts          # Shared exports
│   └── package.json      # Shared package definition
├── vercel.json           # Root Vercel Services configuration & routing
├── package.json          # Root npm workspaces configuration
├── .env.example          # Environment variable specification
└── README.md             # Project documentation
```

---

## Official Venues & Pricing

BE11 features three official Haryana venues (Faridabad & Gurugram):

1. **RRR Cricket Club Kidawali Faridabad**
   - **Location:** Kidawali, Pusta Road, Faridabad (`28.466611, 77.397333`)
   - **Owner:** Rishi (`+91 97116 69718`)
   - **Pricing:** Price on request / Direct contact with owner

2. **Playnow Cricket Ground**
   - **Location:** Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102 (`28.403646, 77.136787`)
   - **Maps Link:** `https://maps.app.goo.gl/omqt5t5SVrkQTMGV9`
   - **Pricing (Both Teams Coverage):**
     - Weekday Morning (07:00 – 11:30): ₹5,000
     - Weekday Afternoon (12:00 – 16:30): ₹5,000
     - Weekday Night (20:00 – 23:30): ₹10,000
     - Weekend Morning (07:00 – 11:30): ₹10,000
     - Weekend Afternoon (12:00 – 16:30): ₹5,000
     - Weekend Day-Night (16:30 – 20:00): ₹10,000
     - Weekend Night (20:00 – 23:30): ₹11,000
   - *No hourly slots. The platform automatically determines weekday/weekend pricing from the selected date.*

3. **AB Cricket Ground**
   - **Location:** New Industrial Town, Aravalli Golf Course precinct, Faridabad (`28.441139, 77.377944`)
   - **Owner:** Rajesh Bajaj (Plus Code: `97PW+V69`)
   - **Match Packages:**
     - Standard Match Package: ₹3,500
     - Extended Day Match Package: ₹6,500
   - *No hourly slots. Package-based match booking.*

---

## Booking Flow & Availability

1. **Flow:** Venue Selection → Date → Match Period (`MORNING`, `AFTERNOON`, `DAY_NIGHT`, `NIGHT`) → Continue to Book → Customer Details → Booking Type (`INDIVIDUAL`, `TEAM_OF_11`, `ENTIRE_VENUE`) → Review → Submit → Admin Review (`PENDING`) → Confirm / Cancel.
2. **Availability:** Computed in real-time from active database bookings. Server-side validation prevents overlapping bookings for the same venue, date, and match period.
3. **Zero Seed Bookings:** Production database starts with 0 bookings.

---

## Local Setup & Development

### 1. Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL database (or Supabase / Neon / local PostgreSQL instance)

### 2. Installation
Install all dependencies across workspaces from repository root:
```bash
npm install
```

### 3. Build Shared Types
```bash
npm run build --workspace=@be11/shared
```

### 4. Database Setup & Prisma
Set `DATABASE_URL` in your environment or `backend/.env`:
```bash
# Generate Prisma Client
npm run prisma:generate --workspace=be11-backend

# Apply database migrations
npx --prefix backend prisma migrate deploy

# (Optional - Dev Only) Seed development venues & demo accounts
npx --prefix backend prisma db seed
```

### 5. Start Development Servers
```bash
npm run dev
```
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:5000](http://localhost:5000)

---

## Production Deployment on Vercel

The repository is built for deployment as a unified project using Vercel Services.

### 1. Import Repository
1. In the Vercel Dashboard, select **Add New... → Project**.
2. Select repository `https://github.com/Ayush-rajput007/be11.git` (branch `main`).
3. Set **Root Directory** to: `.` (Monorepo root — do NOT set to `frontend/`).
4. Framework Preset: **Other** (auto-detected from root `vercel.json`).

### 2. Configure Environment Variables in Vercel

Under **Project Settings → Environment Variables**, configure:

| Variable | Recommended Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production mode |
| `DATABASE_URL` | `postgresql://...` | Hosted PostgreSQL connection string (Supabase / Neon / Railway) |
| `JWT_SECRET` | `your-secure-jwt-secret-min-32-chars` | Used for JWT signing and verification |
| `FRONTEND_URL` | `https://be11.in` | Allowed origin for CORS |
| `VITE_API_URL` | *(leave empty or `https://be11.in`)* | Defaults dynamically to same-domain `/api/v1` |

### 3. Deploy
Click **Deploy**. Vercel will execute `npm run vercel-build`:
1. Compiles `@be11/shared`
2. Generates Prisma Client & compiles `be11-backend`
3. Compiles `be11-frontend` with Vite into `frontend/dist`

### 4. Routing & Endpoints
- Frontend SPA: `https://be11.in/`
- API Health: `https://be11.in/api/health`
- API v1 Endpoints: `https://be11.in/api/v1/...`
- Admin Bookings: `https://be11.in/admin/bookings`

---

## Verification & Build Commands

All builds can be verified locally before pushing:

```bash
# Build complete monorepo
npm run build

# Run Vercel deployment build pipeline
npm run vercel-build

# Shared workspace TypeScript check
npm run build --workspace=@be11/shared

# Backend TypeScript & Prisma build
npm run build --workspace=be11-backend

# Frontend TypeScript & Vite build
npm run build --workspace=be11-frontend
```
