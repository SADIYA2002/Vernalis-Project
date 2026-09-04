# Chrono Attendance & Statutory Payroll Platform

A modern, production-grade Attendance and Payroll management system built with **Next.js 16 (App Router)**, **React 19**, and **Tailwind CSS**. Features self-contained authentication with NextAuth.js, defense-in-depth Role-Based Access Control (RBAC), persistent approval workflows, server-computed statutory payroll calculations, and automated test coverage.

---

## Architecture & Security Model

The application enforces a **defense-in-depth** security architecture across all layers:

```
                  ┌─────────────────────────────────────┐
                  │            Client Browser           │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ 1. Edge Middleware (middleware.ts)  │
                  │    - Validates NextAuth JWT session │
                  │    - Enforces portal route roles    │
                  └──────────────────┬──────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
      ┌───────────────────────────┐     ┌───────────────────────────┐
      │ 2. Server Component Layer │     │ 3. Server API Route Layer │
      │    (app/portal/*)         │     │    (app/api/*)            │
      │    - Session verification │     │    - Caller validation    │
      │    - 403 Forbidden redirects   │ - Direct report scoping │
      │    - UI workspace gating  │     │    - Sensitive redaction  │
      └───────────────────────────┘     └─────────────┬─────────────┘
                                                      │
                                                      ▼
                                        ┌───────────────────────────┐
                                        │ 4. Server In-Memory Store │
                                        │    (lib/server/*)         │
                                        │    - Persistent approvals │
                                        │    - Server payroll math  │
                                        └───────────────────────────┘
```

1. **Edge Middleware (`middleware.ts`)**: Inspects NextAuth session tokens on every request to `/portal/:path*`. Redirects unauthenticated requests to `/login` and unauthorized roles to `/portal/unauthorized`.
2. **Server Component Guards (`app/portal/*`)**: Verifies identity and role server-side before rendering workspace layouts and views.
3. **Hardened API Routes (`app/api/*`)**:
   - `/api/attendance`: Employees can only log attendance for their own employee ID (`403` on spoofing).
   - `/api/corrections` & `/api/leaves`: Employees submit for themselves; Managers can only review their direct reports; HR has org-wide review privileges.
   - `/api/bootstrap` & `/api/employees`: Scopes records to caller; redacts base salary unless caller has `hr` or `payroll` role.
   - `/api/payroll`: Strictly gated to `payroll` and `hr` roles.
4. **Data Persistence (Supabase + PostgreSQL)**: Connected to Supabase cloud PostgreSQL with automatic relational schema (`supabase/schema.sql`) and graceful fallback to the in-memory store when offline.

---

## Supabase (PostgreSQL) Database Setup

The platform uses **Supabase** for persistent cloud data storage across 6 relational tables (`employees`, `attendance_records`, `correction_requests`, `leave_requests`, `leave_balances`, `payroll_locks`).

### 1. Run the Database Migration
1. Log in to [Supabase](https://supabase.com) and open your project dashboard.
2. Go to the **SQL Editor** tab.
3. Open [`supabase/schema.sql`](file:///c:/Users/mulla_z6ocvb5/OneDrive%20-%20Sadhu%20Vaswani%20Institute%20of%20Management%20Studies/Desktop/Vernalis-Project-main/supabase/schema.sql) from this project, paste the entire script into the editor, and click **Run**.
4. This creates all tables, primary/foreign keys, indexes, and populates initial demo data for all 8 employees.

### 2. Configure Environment Variables
Add your Supabase URL and API keys to `.env.local` (and your Vercel Project Settings):

```env
# NextAuth Configuration
NEXTAUTH_SECRET=chrono-dev-super-secret-key-at-least-32-chars-long-2026
NEXTAUTH_URL=http://localhost:3000

# Supabase PostgreSQL Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
# Optional: Service Role Key for server-side elevated privileges
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

> **Note**: If Supabase environment variables are omitted, the application automatically falls back to the in-memory repository with zero disruption, guaranteeing local tests and preview builds succeed.

---

## Demo Personas & Credentials

The application includes 4 pre-configured enterprise personas with default credentials. You can sign in using manual email/password or use the **1-Click Demo Login** buttons on `/login`.

| Role | Name | Email | Password | Allowed Portals |
| :--- | :--- | :--- | :--- | :--- |
| **Employee** | Sadiya Mulla | `sadiya.mulla@acme.co` | `password123` | Employee |
| **Manager** | Vikram Rao | `vikram.rao@acme.co` | `password123` | Employee, Manager |
| **HR** | Meera Joshi | `meera.joshi@acme.co` | `password123` | Employee, Manager, HR, Payroll |
| **Payroll** | Sanjay Verma | `sanjay.verma@acme.co` | `password123` | Employee, Payroll |

*Note: In the portal header, you can switch personas on the fly via the **"Switch Role"** button, which signs in with a fresh signed JWT session.*

---

## Statutory Payroll Math & Policy Rules

The system implements standard Indian statutory attendance-to-payroll calculation rules (`POLICY`):

1. **Base Working Days**: Standard calendar working days excluding weekends and gazetted public holidays (Independence Day, etc.).
2. **Payable Days Formula**:
   $$\text{Payable Days} = \text{Working Days} - \text{Loss of Pay (LOP Days)}$$
3. **Late Arrival Deductions**:
   - A grace window of 15 minutes is allowed (arrival up to 09:15).
   - Arrivals after 09:15 count as **Late**.
   - For every **3 late marks**, a deduction of **0.5 days** (half-day pay) is applied.
4. **Half-Day Attendance**:
   - Each half-day counts as **0.5 payable days** and **0.5 LOP days**.
5. **Paid vs Unpaid Leave**:
   - Approved **Casual**, **Sick**, and **Earned** leaves are paid (1.0 payable day each).
   - Approved **Leave Without Pay (LWP)** deducts 1.0 payable day (1.0 LOP).
6. **Per-Day Rate & Net Attendance Pay**:
   $$\text{Per-Day Rate} = \frac{\text{Monthly Base Salary}}{\text{Total Working Days in Period}}$$
   $$\text{Late Deduction Amount} = \text{Late Deduction Days} \times \text{Per-Day Rate}$$
   $$\text{Net Attendance Pay} = (\text{Payable Days} \times \text{Per-Day Rate}) - \text{Late Deduction Amount}$$
7. **Period Lock**:
   - HR and Payroll officers can freeze the attendance cycle using **"Lock for Payroll"**.
   - When locked, attendance records are finalized for salary disbursement.

---

## Running Automated Tests

The test suite includes 11 statutory math unit tests using Node.js's native test runner (zero external testing dependencies needed):

```bash
# Run unit tests for statutory payroll math
npm test
```

### Test Coverage Breakdown
- **Rule 1**: Full Attendance & Base Computation
- **Rule 2**: Late Arrival Penalty (3 late marks = 0.5 day LOP, 6 late marks = 1.0 day LOP)
- **Rule 3**: Half-Day Attendance (0.5 payable, 0.5 LOP)
- **Rule 4**: Unexcused Absence & Loss of Pay
- **Rule 5**: Paid Leave vs Leave Without Pay (LWP)
- **Rule 6**: Complex Multi-Factor Payroll Simulation (combined present, late, half-day, WFH, and leave)
- **Rule 7**: Boundary Conditions & Non-Negative Clamping
- **Rule 8**: Monthly Analytics (`computeMonthStats`)

---

## Getting Started & Deployment

### 1. Prerequisites
- **Node.js**: v18.17.0+ (Tested on Node.js v24.x)
- **npm**: v9.0.0+

### 2. Environment Configuration
Create a `.env.local` file in the project root:

```env
# Secret key used by NextAuth to sign and encrypt JWT session cookies
NEXTAUTH_SECRET=chrono-dev-super-secret-key-at-least-32-chars-long-2026

# Canonical base URL of your application
NEXTAUTH_URL=http://localhost:3000
```

> **For Production / Vercel Deployments**:
> - Set `NEXTAUTH_SECRET` to a cryptographically secure random string (e.g. generated via `openssl rand -base64 32`).
> - Set `NEXTAUTH_URL` to your production domain (e.g. `https://your-domain.vercel.app`).

### 3. Development Mode
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build & Start
```bash
# Compile optimized production build
npm run build

# Start production server
npm start
```

### 5. Deploying to Vercel
1. Push your code to GitHub / GitLab.
2. Import the project into the [Vercel Dashboard](https://vercel.com).
3. Add environment variables in Vercel project settings:
   - `NEXTAUTH_SECRET`: Random 32+ character string
   - `NEXTAUTH_URL`: `https://<your-project-name>.vercel.app`
4. Deploy! Next.js 16 with App Router is natively optimized on Vercel.

---

## Project Directory Layout

```
├── app/
│   ├── api/                      # Authenticated Server Route Handlers
│   │   ├── attendance/           # Self check-in/out endpoints
│   │   ├── auth/[...nextauth]/   # NextAuth API endpoints
│   │   ├── balances/             # Leave balance endpoints
│   │   ├── bootstrap/            # Secure initial app state loader
│   │   ├── corrections/          # Correction submission & manager review
│   │   ├── employees/            # Scoped employee list
│   │   ├── leaves/               # Leave request & approval endpoints
│   │   ├── payroll/              # Server payroll calculation & period lock
│   │   └── reset/                # Demo reset endpoint
│   ├── login/                    # Credentials sign-in & 1-click demo personas
│   ├── portal/                   # Server Component gated workspaces
│   │   ├── employee/             # Employee attendance & leave portal
│   │   ├── manager/              # Team attendance & approval workflows
│   │   ├── hr/                   # Org-wide analytics, holidays, leave admin
│   │   ├── payroll/              # Payroll inputs, attendance register, lock
│   │   └── unauthorized/         # 403 Forbidden page
│   ├── layout.tsx                # Root layout with SessionProvider
│   └── page.tsx                  # Root redirection based on active role
├── components/
│   └── attendance/
│       ├── portal-shell.tsx      # Top bar, role tabs, persona switcher, auth pill
│       ├── role-workspace.tsx    # Role workspace layout and subnav
│       ├── store.tsx             # Client state synchronized with session
│       └── views/                # Employee, Manager, HR, Payroll views
├── lib/
│   ├── api-client.ts             # Typed client API SDK
│   ├── attendance-data.ts        # Pure business logic & statutory payroll math
│   ├── auth.ts                   # NextAuth credentials provider configuration
│   └── server/                   # Server-side utilities
│       ├── attendance-db.ts      # Server in-memory database & payroll engine
│       └── auth.ts               # Server session and RBAC authorization helpers
├── test/
│   └── payroll-math.test.ts      # 11 statutory math unit tests
├── middleware.ts                 # Edge RBAC middleware
└── package.json                  # Dependencies, test & build scripts
```
