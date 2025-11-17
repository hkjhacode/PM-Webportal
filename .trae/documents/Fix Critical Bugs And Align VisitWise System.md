## Summary of Bugs Found
- Dashboard role routing uses `user.role`/`user.level` instead of `user.roles`, causing wrong dashboard selection and crashes (src/app/dashboard/page.tsx:42).
- Dashboard components call nonexistent/old endpoints and expect wrong response shapes:
  - State Advisor: `/api/state-advisor-stats`, `/api/enhanced-workflows?currentLevel=advisor`; expects `{visits, requests}` (src/components/dashboards/state-advisor-dashboard.tsx:80–93).
  - CEO: `/api/ceo-dashboard-stats`; expects `{visits, requests, stateStats}` (src/components/dashboards/ceo-dashboard.tsx:80–93).
  - Division YP: expects `{visits, requests}` (src/components/dashboards/division-yp-dashboard.tsx:98–103).
- Legacy pages/APIs still in use (e.g., `/api/workflows`) causing 404s (src/app/dashboard/requests/[id]/page.tsx:63).
- Inconsistent role names: `'Division HOD'` vs `'State Division HOD'`, `'PMO Viewer'` seeded but backend requires `'PMO'` (src/app/api/dev/users/reset/route.ts:34–35; src/app/api/ai/route.ts:19).
- Audit logger used incorrectly via private `auditLogger.log(...)` with mismatched payloads across routes (e.g., src/app/api/pm-visits/route.ts:129–146; src/app/api/enhanced-workflows/route.ts:159–175, 383–399; src/app/api/users/enhanced/route.ts:178–196; src/app/api/dynamic-forms/templates/route.ts:114–133, 249–267; src/app/api/notifications/route.ts:42–60).
- Missing UI component `FileUpload` referenced by dynamic form renderer (src/components/forms/dynamic-form-renderer.tsx:14), causing runtime errors.
- Empty/placeholder files present (deadline-alerts route, main-dashboard, enhanced-user-management) leading to dead code.

## Fix Plan
### 1) Normalize Roles and RBAC
- Define a single source of truth for roles: `['PMO','CEO NITI','State Advisor','State YP','State Division HOD','Division YP','Super Admin']` in `types` and ensure all backend checks match.
- Update AI route allowed roles to use canonical names (src/app/api/ai/route.ts:19).
- Update dev seed to create a true PMO (`roles: [{ role: 'PMO' }]`) and correct HOD naming (src/app/api/dev/users/reset/route.ts:34–35, 57–61).

### 2) Fix Dashboard Routing and Props
- Refactor `src/app/dashboard/page.tsx` to read `user.roles` and select dashboard by highest role present; derive `userState`/`userDivision` from role assignments.
- Remove references to `user.role`, `user.level`, `user.division` and pass props from `user.roles` entries consistently.

### 3) Align Dashboard Data Fetching
- Replace calls to nonexistent endpoints with existing APIs:
  - Use `/api/pm-visits` and `/api/enhanced-workflows` with query filters (`state`, `currentAssigneeId`, `status`).
  - Compute metrics client-side (pending/overdue/completion rates) from returned arrays.
- Update components to consume raw arrays (since APIs return arrays) instead of `{visits, requests}` wrappers.
- Remove `/api/state-advisor-stats` and `/api/ceo-dashboard-stats` dependencies or implement minimal equivalents that proxy computed stats from `PMVisit` and `EnhancedWorkflowRequest`.

### 4) Replace Legacy API Usage
- Update `src/app/dashboard/requests/[id]/page.tsx` to fetch from `/api/enhanced-workflows?id=...` and adapt mapping.
- Mark old routes (`/api/workflows`, `/api/forms`, `/api/templates`, `/api/merge`) as deprecated and ensure no UI references remain.

### 5) Correct Audit Logging Calls
- Replace all `auditLogger.log(...)` calls with the proper public methods:
  - Auth: `logAuthentication('login'|'logout'|'login_failed', ...)` (src/app/api/auth/route.ts).
  - PM Visits: `logPMVisitAction('created'|'activated'|'completed'|'cancelled', ...)` (src/app/api/pm-visits/route.ts).
  - Workflows: `logWorkflowAction('created'|'approved'|'rejected'|'rollback'|'submitted', ...)` (src/app/api/enhanced-workflows/route.ts).
  - Dynamic Form Templates: `logFormTemplateAction('created'|'updated', ...)` (src/app/api/dynamic-forms/templates/route.ts).
  - Notifications: use `logSystemEvent('alert_sent', ...)` or `logDataAccess('viewed', ...)` as appropriate.
- Ensure metadata (ip, userAgent) is passed via the `requestInfo` param, matching method signatures.

### 6) Implement Missing UI Component
- Add `src/components/ui/file-upload.tsx` with a simple, accessible file selector that returns selected files via `onFilesChange` to satisfy DynamicFormRenderer.

### 7) Clean Up Empty/Dead Files
- Either implement minimal functionality or remove:
  - `src/app/api/deadline-alerts/route.ts`: implement GET that returns upcoming/overdue counts using `PMVisit` and `EnhancedWorkflowRequest`.
  - `src/components/dashboards/main-dashboard.tsx`, `src/components/users/enhanced-user-management.tsx`: remove if unused.

### 8) Dev Seed Modernization
- Update `src/app/api/dev/seed/route.ts` to seed dynamic form templates and a sample PM Visit aligned with the new models, and use canonical roles.

## Verification
- Run type-check and dev server; verify dashboards render for each role and navigation works.
- Create a PM Visit via `PMVisitCreator`, confirm deadlines cascade and PMO-only access.
- Test workflow creation and approval chain across roles; confirm audit logs print in dev.
- Submit a dynamic form using the new `FileUpload` component; validate client-side rules and submission.

## Notes
- No secrets will be logged; audit entries omit sensitive payloads.
- Changes keep Next.js app-router structure and existing UI library conventions.

Please confirm, and I will implement these fixes end-to-end in one pass, with code edits and validation.