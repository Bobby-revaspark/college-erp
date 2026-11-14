# Campus — College Student ERP

## Current deployment: static demo, no database

Vercel is currently configured as a browser-only demo. It bundles 10 students, departments/courses, fee ledgers and payments, attendance, timetable and fee structures from `src/data.ts`. All four roles can be previewed without login. Changes are saved only in that browser's local storage; they are not shared across users/devices. PDF receipts and CSV/PDF reports work locally.

Deploy the source to Vercel with framework **Vite**. The committed config uses `npm run build:static` and output `dist`. No `DATABASE_URL`, `JWT_SECRET`, migration, seed command, backend deployment or admin setup is required. The static build forces demo mode even if an old `VITE_DEMO_MODE=false` variable remains. You can remove the old database/auth variables from the Vercel project. Push/import this version and redeploy; do not override its build command with the earlier full-stack command.

To preview locally:

```sh
npm install
npm run build:static
npx vite preview
```

The backend and MySQL source remain available for a future live installation. The full-stack instructions below apply only after explicitly enabling that mode.

React 19 + TypeScript + Tailwind CSS, Recharts, Express 5, and Prisma/MySQL 8. The browser UI includes a clearly marked, persistent demo workspace; the API always requires real authentication. The two modes do not share data.

## Requirements

Node.js 22.x, npm, MySQL 8 (or Docker Compose). Production needs HTTPS, a long random session secret, and a reachable MySQL server.

## Quick preview

```sh
npm install
cp .env.example .env
npx vite --host 0.0.0.0
```

Open http://localhost:5173. Development defaults to `VITE_DEMO_MODE=true`, which uses browser storage and sample records. The current `.env.production` enables demo data. Set `VITE_DEMO_MODE=false` only when deliberately restoring a database-backed deployment. It is suitable for evaluating workflows, not storing actual student data. Demo role switching is available only in this mode. Reset via the application's reset control or clear its local storage.

## Run the full stack

1. Copy `.env.example` to `.env`. Set `JWT_SECRET` to a random secret of at least 32 characters, for example with `openssl rand -hex 32`. Set `SEED_PASSWORD` to a unique password of at least 12 characters.
2. Start MySQL with `docker compose up -d mysql`, or provision a MySQL database and user yourself. Set `DATABASE_URL` accordingly. Docker's default passwords are only for local development; override them before using a shared machine.
3. Set `VITE_DEMO_MODE=false` in `.env` to enable real authentication and API persistence.
4. Initialize and seed:

```sh
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to port 3001. `APP_ORIGIN` must exactly match the browser origin; the server rejects state-changing requests from other origins.

### Seed accounts

All use your configured `SEED_PASSWORD`:

| Role | Email |
| --- | --- |
| Principal / admin | admin@campus.edu |
| Accountant | accounts@campus.edu |
| Faculty | ananya@campus.edu |
| Faculty | vikram@campus.edu |
| Students | student1@campus.edu through student10@campus.edu |

The idempotent seed preserves existing records. It adds three departments/courses, semester fee structures, ten students, payments, attendance and Monday–Saturday lectures. Changing `SEED_PASSWORD` does not reset existing accounts. Newly registered students receive the initial password entered by the administrator; distribute it privately.

## Modules

- Overview with calculated student, fee and attendance metrics, collection trends, department chart, payments and schedule.
- Student directory, registration, and profiles with fee, attendance and timetable views.
- Fee structures, partial collections, payment references, outstanding balance and downloadable PDF receipts.
- Subject attendance with present/absent/late, bulk present and a 75% threshold. Late counts as attended.
- Weekly timetable with class, subject, room and faculty assignment; server rejects conflicts.
- Downloadable fee, pending dues and attendance reports. CSV files open in Excel; PDFs are generated in the browser from authorized data.
- Administration for departments, courses, fee structures and staff roles.

Student `totalFee` is a snapshot of the course/semester fee structure at registration. Editing a structure affects future registrations; it does not silently change existing ledgers. Semester advancement and ledger adjustments require an explicit operational policy and are not automated. Payments are immutable in this version; refunds and reversals are not supported.

## Access control

| Capability | Admin | Accountant | Faculty | Student |
| --- | --- | --- | --- | --- |
| Register students / manage college | Yes | No | No | No |
| Collect fees / fee structures | Yes | Yes | No | No |
| Attendance | All | Read | Assigned subjects | Own, read |
| Timetable builder | Yes | No | No | No |
| Student records | All | All | Assigned classes | Own |
| Financial records | All | All | No | Own |

Authorization is enforced in Express and data is scoped before leaving the server. Hiding navigation is only a usability feature. Auth uses bcrypt password hashing, signed HttpOnly cookies, revocable database sessions, an eight-hour expiry, login throttling, Helmet headers, and exact Origin validation for writes. Role updates revoke target sessions. Students cannot promote themselves and a staff user cannot change their own role.

The MySQL schema uses a constrained `Role` enum rather than an editable roles table. All monetary values are stored as Decimal(12,2). Collections lock the student's row within a transaction before checking the remaining balance. Timetable creation serializes conflict checks. Dates are stored in UTC; attendance uses MySQL DATE. Receipt IDs are unique.

## Production

```sh
# For a live backend, first set VITE_DEMO_MODE=false in .env.production.
npm run db:generate
npm run build
NODE_ENV=production npm start
```

The Express server serves `dist/` and `/api` on `PORT` (default 3001). Put it behind an HTTPS reverse proxy and set `APP_ORIGIN` to your exact public URL. Secure cookies require HTTPS. Use a managed MySQL service with TLS, least-privilege credentials and tested backups. Keep `.env` out of source control. Do not expose MySQL publicly. The supplied compose file binds MySQL only to localhost.

The initial MySQL migration is included in `prisma/migrations`. Apply it with `npm run db:migrate`. `db:push` is an alternative for disposable local development databases only. Generate future reviewed migrations against a development database with `npx prisma migrate dev --name <change>` and apply them with `npm run db:migrate`. Do not run development schema commands against production data. If you initialized a local database using `db:push`, baseline it with `npx prisma migrate resolve --applied 20261114000000_init` before using migration deploy.

This repository provides the application implementation, not a certified production deployment. Complete environment-specific acceptance tests, backup/restore testing, monitoring, accessibility review and institutional data-retention policies before storing real records. Password recovery, email delivery, fee refunds, automated semester promotion, and a full audit-log UI are not included. Multi-instance deployments should replace the default in-memory request limiter with a shared store. The requested MySQL server needs a Node-compatible host; it is not packaged as a Cloudflare Worker.

## Validation

```sh
npm test
npm run build
npx prisma validate
```

Tests cover role separation, lecture overlap and attendance calculation. With the API running against seeded MySQL, run `npm run test:integration` for automated authentication, role boundaries, registration, concurrent payments, reference uniqueness, timetable conflicts and logout tests. The integration script temporarily creates a student, cleans up its records, and uses the configured seed password. Additional integration acceptance should include logging in as each role, attempts to read another student's records, concurrent fee collections, duplicate transaction references, conflicting lectures, report exports and persistence after refresh. `/api/health` checks database connectivity.

## Layout

- `prisma/schema.prisma`, `prisma/seed.ts`: relational schema and seed data.
- `server/app.ts`: validated API routes, authentication, scoping and transactions.
- `server/index.ts`: standalone Node server; `server/vercel-handler.ts`: optional Vercel function adapter (inactive in the static deployment).
- `server/security.ts`: authorization and shared policy helpers.
- `src/`: React application, demo data, UI and exports.
- `tests/`: security policy checks.

## Verification performed

The production build, Prisma schema validation, six policy tests and the automated API integration suite passed against a local MySQL 8.4 container. Desktop, tablet and mobile browser rendering was reviewed. Real admin login and loading MySQL dashboard records were also verified in the browser. `npm audit` reported zero vulnerabilities after patching jsPDF and overriding the affected transitive configuration dependency. Institutional acceptance and deployment-specific operations still need verification.


## Railway deployment (Hindi / Hinglish)

Frontend aur API **ek hi app service** par run honge. MySQL alag database service hogi. `dist/` ko alag static site ki tarah deploy mat karein: authentication aur MySQL API ko Express server chahiye.

### 1. Code upload karein

GitHub par private repository bana kar project ka source push karein. `Dockerfile`, `railway.json`, `package-lock.json`, `prisma/`, `server/`, `src/` aur baaki source files include karein. `.env`, `node_modules` aur `dist` upload nahi karne hain. Is workspace mein Git abhi initialize nahi hai.

GitHub ke bina Railway CLI se bhi local source upload ho sakta hai:

```sh
railway login
railway init
railway add --database mysql
railway add --service campus-erp
railway service link campus-erp
```

CLI se service banane ke baad neeche wale variables dashboard mein set karein, phir `railway up` chalayein. `.railwayignore` local secrets aur generated files ko upload se exclude karti hai.

### 2. Railway project aur MySQL banayein

Railway dashboard mein **New Project** banayein. Usmein **MySQL** database add karein, phir **GitHub Repo** se app service add karein (ya CLI se banayi app service use karein). App aur MySQL ek hi project/environment mein hone chahiye. App root directory repository root rahegi.

### 3. App service ke Variables set karein

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` — `MySQL` ko apni actual database service ke naam se replace karein |
| `JWT_SECRET` | `openssl rand -hex 32` se generated nayi random value |
| `NODE_ENV` | `production` |
| `VITE_DEMO_MODE` | `false` |
| `ADMIN_EMAIL` | Apna initial admin email |
| `ADMIN_NAME` | Principal / admin ka naam |
| `ADMIN_PASSWORD` | Kam se kam 12 characters ka strong initial password |

Local `.env` wala localhost database URL Railway par use nahi karna hai. Database URL manually copy karne ke bajay Railway variable reference use karein. `PORT` Railway khud provide karta hai; application use read karti hai.

### 4. Deploy aur public domain

`railway.json` Docker build, `npm run db:migrate` pre-deploy step, `npm start`, aur `/api/health` health check configure karti hai. Build ko database connection ki zarurat nahi; migrations runtime database variables ke saath pre-deploy phase mein chalti hain. Migration fail ho to deployment aage nahi badhega.

App service mein **Settings → Networking → Generate Domain** karein. Generated domain Railway ke `RAILWAY_PUBLIC_DOMAIN` se automatically accepted origin ban jayega. Agar first deployment public domain configure hone se pehle fail ho, domain generate karke redeploy karein.

Custom domain use karte waqt `APP_ORIGIN=https://your-domain.example` set karein aur redeploy karein. URL mein page path mat add karein. Login par `Invalid request origin` aaye to browser URL aur `APP_ORIGIN` match karein.

### 5. Pehla admin banayein

Successful deployment ke baad app service ke remote shell mein run karein:

```sh
railway link
railway service link campus-erp
railway ssh -- npm run db:admin
```

`railway link` mein apna deployed project/environment select karein. `railway ssh` ke liye CLI account/project access chahiye. Yeh command deployed container mein run hoti hai, jahan private MySQL hostname reachable hai. `railway run` local machine par command chalata hai, isliye private database hostname ke saath use mat karein.

Ab public HTTPS URL par `ADMIN_EMAIL` aur `ADMIN_PASSWORD` se login karein. Account banne ke baad Railway variables se `ADMIN_PASSWORD` remove kar sakte hain; password database mein bcrypt hash ke roop mein stored hai. `db:admin` dobara chalane par existing admin ka password change nahi hota.

Sirf demo installation ke liye ten students aur sample staff chahiye to `SEED_PASSWORD` set karke remote shell mein `npm run db:seed` chalayein. Real college database par dummy seed chalane ki zarurat nahi. Har deployment par seed automatic nahi chalti.

### 6. Verify karein

- `https://YOUR-DOMAIN/api/health` par `{"status":"ok"}` aaye.
- Login ke baad **Secure college workspace** dikhe; interactive demo banner nahi.
- Student register karke refresh karein aur persistence verify karein.
- Railway deployment logs mein migration/build errors check karein.

App ek replica se start karein; multiple replicas ke liye shared rate-limit storage configure karna hoga. Database backups Railway MySQL/volume settings se configure karein. Custom domain change par `APP_ORIGIN` update karna zaroori hai.

Official references: [Railway MySQL](https://docs.railway.com/databases/mysql), [Config as code](https://docs.railway.com/config-as-code/reference), [Pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command).


### Deployment recheck — 14 November 2026

Checked locally without logging into or deploying to any Railway account:

- Node 22 Linux Docker image builds successfully from the lockfile; dependency install audit reports zero vulnerabilities.
- All six policy/origin tests, TypeScript production build and Prisma schema validation pass.
- Initial migration and seed successfully run against a fresh, isolated MySQL 8.4 database.
- API integration suite passes inside the production container: authentication, role boundaries, own-student scope, faculty assignments, registration, simultaneous overpayment prevention, duplicate references, timetable conflicts, CSRF and logout revocation.
- Production HTML, built JS/CSS assets, SPA routes and database health endpoint return successful responses.
- Session cookies include Secure, HttpOnly and SameSite=Lax; production security headers are present.
- Initial admin creation, repeat-run preservation and invalid-password rejection pass.
- Container runs as a non-root user and excludes local .env files, cloud credentials and Railway account bindings. Production bundle excludes the demo workspace storage code.
- Fixed the local Compose MySQL readiness probe to check TCP instead of the temporary initialization socket.

The Docker runtime check used local Linux ARM64 containers. Actual Railway networking, its account/project permissions, domain and provisioned database will be verified when deployed there. Temporary verification containers/databases were removed; the development database was not changed by these checks.

**Different-account handoff:** source files contain no project ID or account binding. The other owner can deploy the source in their own Railway project and create a new MySQL service there. They must supply their own `DATABASE_URL` reference, `JWT_SECRET`, initial admin credentials and public domain. Local records are not copied automatically. Do not transfer your local `.env` or Railway login credentials. Use the generated domain, or set `APP_ORIGIN` to that account's custom HTTPS domain.


## Optional full-stack Vercel deployment (currently disabled)

The active `vercel.json` is static-only. To restore this advanced setup later, copy `deployment/vercel-fullstack.json` to root `vercel.json`, set `.env.production` to `VITE_DEMO_MODE=false`, and create `api/index.ts` containing `export { default } from '../server/vercel-handler';`. Then follow the database setup below. The API entry was moved out of the root `api/` directory so Vercel does not build a database function for the static demo.

Vercel par React frontend **aur Express API** dono ek project/domain mein deploy honge. `vercel.json` Vite assets ko `dist/` se aur `/api/*` requests ko `api/index.ts` function se serve karta hai. Vercel ke liye `npm start`, Dockerfile ya Railway CLI use nahi hote.

**MySQL alag host par chahiye.** Local Docker database ya Railway ka private `*.railway.internal` hostname Vercel se reachable nahi hoga. Apne hosted MySQL provider ka internet-reachable connection URL, TLS options aur network-access settings use karein. Existing Railway MySQL use kar rahe hain to uska public TCP connection URL chahiye, private `MYSQL_URL` nahi. Apne provider ke mutabik URL par small Prisma pool configure karein (for example, existing query string mein `&connection_limit=3&pool_timeout=20`, ya query string na ho to `?connection_limit=3&pool_timeout=20`). Database ko function region ke paas rakhein.

### 1. Import project

Source GitHub par push karke intended owner's Vercel account mein **Add New → Project → Import Git Repository** karein. Repository root select karein. Framework **Vite**, Node **22.x**, output **dist** rahega. Build/install commands `vercel.json` mein already hain:

- Install: `npm ci --include=dev`
- Build: `npm run vercel-build`
- Output: `dist`

### 2. Production environment variables

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Hosted MySQL ka reachable URL, provider TLS settings ke saath |
| `JWT_SECRET` | `openssl rand -hex 32` ki generated secret value |
| `VITE_DEMO_MODE` | `false` |
| `APP_ORIGIN` | Final public HTTPS domain, for example `https://your-campus.vercel.app` |

`DATABASE_URL` aur `JWT_SECRET` ko kabhi `VITE_` prefix mat dein. `APP_ORIGIN` final domain pata hone par set karke redeploy karein. Agar `APP_ORIGIN` unset hai to API exact deployment origin `https://${VERCEL_URL}` use karegi; stable production alias/custom domain par login ke liye usi domain ka explicit `APP_ORIGIN` set karein.

Production build Prisma client generate karta hai, migrations apply karta hai, phir frontend build karta hai. Database connection/migration fail ho to deployment build fail hoga. Preview builds production database migrate nahi karti. Preview chahiye to uske liye **separate already-migrated database**, separate `JWT_SECRET`, aur preview-scoped settings dein. Production `APP_ORIGIN` ko Preview scope mein copy mat karein; deployment's `VERCEL_URL` fallback use hone dein.

### 3. Initial admin / sample data

Vercel function shell mein seed scripts chalane ki zarurat nahi. Local trusted terminal se **usi target database** ka URL environment mein set karke:

```sh
npm ci
npm run db:generate
npm run db:migrate
# Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD securely in the environment.
npm run db:admin
```

Apni local Docker wali `.env` use karke command chalane se admin local DB mein banega, Vercel wale DB mein nahi. Target database URL verify karein. Admin setup ko build command mein add mat karein. Dummy records chahiye to target DB aur `SEED_PASSWORD` configure karke `npm run db:seed` sirf test installation par chalayein.

### 4. Verify deployed portal

- `/api/health` → `{"status":"ok"}`.
- `/api/auth/me` without login → JSON 401, HTML page nahi.
- Final domain par admin login; **Secure college workspace** dikhe.
- Browser refresh ke baad records persist hon; receipts/reports download hon.
- Login par `Invalid request origin` ho to exact HTTPS `APP_ORIGIN` fix karke redeploy karein.

API health and authenticated responses use `Cache-Control: no-store`. Serverless instances reuse their module-level Prisma client; requests ke beech `$disconnect()` nahi hota. Built-in in-memory request limiter per instance hai: institutional production traffic ke liye shared rate-limit storage/platform protection configure karein. Function duration is configured to 60 seconds; successful payment ke baad retry karne se pehle receipt/ledger verify karein.

Local verification: nine policy/routing/origin tests and the TypeScript/Vite production build pass. The exported Vercel adapter was also exercised on a local HTTP server against MySQL: rewritten health/auth paths, no-store headers and the full API integration suite passed. Vercel account access, cloud build, function routing on the hosted platform, target MySQL network/TLS access and production-domain login still need verification after deployment. No Vercel account is linked in this repository.

References: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel rewrites](https://vercel.com/docs/routing/rewrites).
