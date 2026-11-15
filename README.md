# Campus — College Student ERP

A college operations portal built with React 19, TypeScript, Vite, Tailwind CSS, Shadcn-style source components, Recharts, Express 5, Prisma 6 and MySQL 8.4. The current production configuration uses authenticated APIs backed by Aiven MySQL.

## Main features

- Admin, Accountant, Faculty and Student roles, enforced by the API and scoped database queries.
- Student registration, enrollment IDs, photos, searchable directory and profiles.
- Course/semester fee structures, partial collections, outstanding balances and historical receipt balances.
- College header, footer, login branding, downloadable PDF receipts and CSV/PDF reports.
- Student payment submissions with transaction references and optional screenshots; staff verification is required before fees become paid.
- Subject attendance with present/absent/late, a 75% threshold, and India calendar dates.
- Monday–Saturday timetables with room/faculty/class conflict checks.
- Dynamic college identity, departments, courses, subjects, staff accounts and staff roles.

## Student payment flow — no Razorpay

1. Student signs in and opens **Fee management** to view their fee statement and outstanding balance.
2. **View payment details** shows the college's QR/UPI/bank instructions. Until the administrator adds a genuine QR, an explicit **Demo QR — not for payments** placeholder is shown. It cannot receive money.
3. After making a real payment outside the portal, the student submits the amount, date, UTR/transaction ID and optionally a screenshot.
4. The request remains **Pending verification**. Submitting proof does not reduce fees and does not generate a paid receipt.
5. Admin/Accountant opens **Fee management → Student payment verification**, checks the college bank/UPI account, and approves or rejects with a note.
6. Approval atomically creates the ledger entry and receipt. Repeated approval returns the same receipt. Rejection leaves the ledger unchanged.

The portal does not debit bank accounts, automatically validate bank transfers, or integrate a payment gateway. A screenshot alone is not confirmation of received funds. Refunds and reversals are not implemented; staff must resolve excess/unmatched payments through the college's financial process.

Staff can also record payments received directly: **View fees → Collect payment → Review → Confirm & record → Receipt**. Both full and partial payments are supported, with server-side balance checks and idempotent retries.

## Your college name, logo and genuine payment QR

Sign in as Admin and open **Administration → College identity**:

- Edit college name, address, contacts, website, academic year and receipt note.
- Upload a college logo: PNG/JPG/WebP, up to 350 KB. Save settings to update the header, footer, login and receipts.
- Alternative logo path: add `public/college-logo.png`, publish, then set the logo path to `/college-logo.png`.
- Add your genuine UPI ID, bank instructions and payment QR image. Removing the payment QR restores the explicitly labelled demo placeholder.

Missing logos fall back to a graduation-cap icon. No genuine logo or payment destination is bundled. The default editable college name is Gandhi P.R. College. See [public/README-logo.md](public/README-logo.md).

## Requirements

Node.js 22.x, npm and MySQL 8 (or Docker). Production requires HTTPS and a strong session secret. Never commit local environment files or expose database/session credentials in `VITE_` variables.

## Local demo without a database

```sh
npm ci
npm run build:static
npx vite preview
```

This deliberately builds a browser-only demonstration with sample records and role switching. Changes persist only in that browser's localStorage and are not shared with MySQL or other users. It is for UI evaluation, not real student records. `build:static` does not change the committed live Vercel routing configuration.

## Local full stack

```sh
cp .env.example .env
# Set a strong JWT_SECRET and database connection in .env.
# Set VITE_DEMO_MODE=false for authenticated local development.
docker compose up -d mysql
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:5173. The API listens on 3001. Set `APP_ORIGIN` to the exact browser origin. Vite's optional `API_PROXY_TARGET` can override the local API proxy target.

`SEED_PASSWORD` must be at least 12 characters. Seed accounts include an admin, accounts@campus.edu, ananya@campus.edu, vikram@campus.edu and student1@campus.edu through student10@campus.edu. By default the admin is admin@campus.edu; set `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` to customize the initial administrator. When configured, the admin uses `ADMIN_PASSWORD`; other sample users use `SEED_PASSWORD`. Repeated seeding preserves existing records/passwords.

For a clean institution without dummy records, migrate and run `npm run db:admin` with `ADMIN_EMAIL`, `ADMIN_NAME` and a strong `ADMIN_PASSWORD`; skip `db:seed`.

## Aiven MySQL

The configured service database is **college-erp** (hyphen). Its initial and subsequent additive migrations were applied without resetting existing student or fee data.

Store private connection details in ignored `.env.aiven`:

```dotenv
DATABASE_URL="mysql://USER:URL_ENCODED_PASSWORD@AIVEN_HOST:PORT/college-erp"
DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----\nPROJECT_CA_CONTENT\n-----END CERTIFICATE-----"
JWT_SECRET="A_NEW_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"
APP_ORIGIN="https://collegee-erp.vercel.app"
VITE_DEMO_MODE=false
ADMIN_EMAIL="admin@gmail.com"
ADMIN_NAME="College Administrator"
ADMIN_PASSWORD="YOUR_PRIVATE_ADMIN_PASSWORD"
SEED_PASSWORD="YOUR_SEPARATE_PRIVATE_SAMPLE_PASSWORD"
```

Restrict file permissions with `chmod 600 .env.aiven`. The supplied local file contains the generated passwords and must remain untracked. The live admin is admin@gmail.com; its actual password is only in that private file.

`DATABASE_CA_CERT` accepts real PEM newlines or literal `\n`. The backend validates the CA, creates a private temporary certificate file and enforces Prisma `sslaccept=strict`. Default Aiven pool size is 3; existing explicit pool settings are respected. Certificate validation is not disabled.

```sh
DOTENV_CONFIG_PATH=.env.aiven npm run db:check
DOTENV_CONFIG_PATH=.env.aiven npm run db:migrate
DOTENV_CONFIG_PATH=.env.aiven npm run db:admin
```

On this Mac the native Prisma TLS stack rejected the project CA; Linux successfully verified issuer, hostname and TLS. Use the optional Linux tooling runner if that occurs:

```sh
docker compose -f deployment/aiven-tools.compose.yml run --build --rm tools npm run db:check
docker compose -f deployment/aiven-tools.compose.yml run --rm tools npm run db:migrate
```

`db:check` reports connectivity/table count only. Use migrations for hosted databases, not `db:push` or reset. Back up institutional data using the database provider's supported backup process.

## Vercel production deployment

Import the intended GitHub repository, select **Vite**, root directory at the repository root, Node 22.x. The committed `vercel.json` provides:

- Install: `npm ci --include=dev`
- Build: `npm run vercel-build`
- Output: `dist`
- `/api/*` routed to the Express function adapter; other application routes serve the SPA.

Set these backend variables in the intended Vercel project's **Production** environment:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Aiven URI, selecting `/college-erp` |
| `DATABASE_CA_CERT` | Complete Aiven project CA certificate |
| `JWT_SECRET` | Strong generated session secret |
| `APP_ORIGIN` | `https://collegee-erp.vercel.app` |
| `VITE_DEMO_MODE` | `false` |

Copy secret values from the private local file into Vercel's environment UI; never add database credentials to frontend source. Initial admin/sample passwords are setup credentials, not required as runtime Vercel variables.

The live build generates Prisma, migrates Production and builds the UI with demo mode explicitly disabled. A failing migration stops the build. Preview deployments must use a separate already-migrated database and separate credentials; Production secrets should not be copied into Preview scope. Custom-domain changes require an updated exact HTTPS `APP_ORIGIN`.

After publishing, verify `/api/health`, real login on the final domain, persistence after refresh, role boundaries and receipt exports. An Interactive demo banner means the earlier static build is still deployed. The Linux Docker image can also serve the app on a Node-compatible host; `railway.json` is retained for that alternative.

## Data and security behavior

- HttpOnly, Secure (production), SameSite=Lax cookies; signed JWTs with revocable database sessions and eight-hour expiry.
- bcrypt password hashing, exact Origin checking for writes, Helmet headers and request throttling.
- Students see only their own records; faculty only assigned classes and no fee transactions. Admin-only branding/staff/academic setup APIs.
- Monetary values use MySQL Decimal(12,2). Student fees are registration snapshots; editing a fee structure affects future registrations, not existing ledgers.
- Row locks protect fee balance checks and approval. Idempotency keys and unique bank references prevent duplicate records.
- Receipts use balance at the recorded transaction, not today's outstanding balance. Legacy receipts derive a historical balance.
- Payment proof is visible only to its submitting student and fee staff; proof images are fetched individually rather than included in lists.
- India calendar date validation permits today's attendance/payments after midnight even while the server remains on the previous UTC day.
- In-memory throttling is per instance; configure a shared store/platform protection for multi-instance institutional traffic.

Password recovery, automated refunds, semester promotion and a comprehensive audit-log UI are not included. Complete institutional acceptance, monitoring and backup/restore checks before onboarding real student data.

## Verification

```sh
npm run db:generate
npm run build
node --import tsx --test tests/*.test.ts
npx prisma validate
# With a seeded database and API running:
npm run test:integration
npm run test:student-payments
```

Integration suites use temporary student/payment/staff/subject fixtures and clean them up. The production function adapter was exercised against Aiven with real authentication, scoped access, concurrent collections, idempotent retries, receipt balances and student submission/approval/rejection flows. No genuine bank transfer is performed by these tests.

## Source layout

- `src/App.tsx`: role-specific portal, forms, dashboards and reports.
- `src/institution.tsx`, `src/fees.tsx`, `src/receipts.tsx`, `src/student-payments.tsx`: branding and fee/payment workflows.
- `server/app.ts`: Express authentication and validated module APIs.
- `server/student-payments.ts`: scoped student submissions and transactional staff review.
- `server/database-config.ts`: verified Aiven TLS configuration.
- `api/index.ts`, `server/vercel-handler.ts`: serverless adapter and routing.
- `prisma/`: MySQL schema, committed migrations, seed and initial-admin setup.
- `tests/`: policy, calendar, receipt and API integration checks.

### Local development with Aiven

When the private `.env.aiven` file is present, `npm run dev` starts the API in Docker with verified Aiven TLS and opens Vite at `http://localhost:5173` in live mode. Start Docker Desktop first. The first run builds the API image. Sign in with your real admin account; the demo role selector is unavailable. New registrations persist in Aiven. Run `npm run dev:stop` to stop the local API. Never share `.env.aiven` or commit credentials.

On Vercel, set `VITE_DEMO_MODE=false` in the deploying project's environment variables and redeploy. Changing environment variables does not update an already built frontend.

### Vercel ESM module loading

Backend relative imports use explicit `.js` extensions so the compiled server works with native Node ESM. `tsconfig.server.json` checks NodeNext module resolution; `npm run test:server-build` compiles and imports the actual API entry with plain Node, without `tsx` or database access. If deploying from another repository, copy the updated `api/`, `server/`, `scripts/`, `package.json` and `tsconfig.server.json` together, then redeploy.
