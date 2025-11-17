## Goals
- Run the app locally to validate behavior
- Walk through auth, dashboards, user management, requests/workflows, alerts
- Confirm data/API integrations and credential generation flow

## Steps
### Setup & Launch
1. Install dependencies: `npm install`
2. Create required env vars: `.env.local` for DB/JWT secrets (per `src/lib/db.ts` and `src/lib/auth.ts`)
3. Start dev server: `npm run dev` (Next.js with Turbopack)

### Authentication
1. Review `src/app/api/auth/route.ts` to confirm login/cookie flow
2. Login via `src/app/page.tsx` and ensure redirect to `/dashboard`
3. Validate `use-auth` context behavior and role checks

### Dashboards & Navigation
1. Explore role-targeted dashboards under `/dashboard` (PMO/CEO/state/division)
2. Verify layout, sidebar, assistant panel (`src/app/dashboard/layout.tsx`)

### User Management
1. Open `/dashboard/user-management`
2. Create users and observe auto-generated credentials from `src/lib/user-credential-generator.ts`
3. Confirm unique email generation and optional password reset via `generateSecurePassword`

### Requests/Workflows
1. Navigate `/dashboard/requests` and a detail route `/dashboard/requests/[id]`
2. Exercise create/approve/filter flows via `src/app/api/workflows/route.ts`

### Alerts & Notifications
1. Check `/api/deadline-alerts` counts integration in UI
2. Validate in-app notifications

### Data & Persistence
1. Confirm Mongo connection (`src/lib/db.ts`) and models working (User/Request/Doc)
2. Seed dev data via `src/app/api/dev/users/reset/route.ts` if needed

### Visuals/Theming
1. Verify Tailwind styles, theme provider, and image domains from `next.config.mjs`

### Deliverables
- A short validation report covering: auth, dashboards, user management with credentials, requests workflow, alerts, persistence