## Goals
- Ensure CEO NITI and all dashboards follow the dark/light theme tokens consistently.
- Remove the persistent right blank space; make dashboards full-width and move the AI assistant to an overlay (no reserved column).
- Show auto-generated user credentials (ID/pass) for 30 seconds after Super Admin creates a user.
- Enforce uniqueness: no two users can share the same post/role at the same scope.

## Implementation Plan
### 1) Theme Audit for Dashboards
- Replace fixed colors (`text-gray-...`, `bg-gray-...`) with theme tokens across dashboards:
  - `text-foreground`, `text-muted-foreground`, `bg-background`, `border` classes.
- Update components:
  - `src/components/dashboards/ceo-dashboard.tsx`
  - `src/components/dashboards/pmo-dashboard.tsx`
  - `src/components/dashboards/state-advisor-dashboard.tsx`
  - `src/components/dashboards/state-yp-dashboard.tsx`
  - `src/components/dashboards/division-hod-dashboard.tsx`
  - `src/components/dashboards/division-yp-dashboard.tsx`
- Adapt chart colors using CSS variables (e.g., `var(--chart-1)`) or theme-aware palette.

### 2) Layout Refactor To Full-Width Content
- Modify `src/app/dashboard/layout.tsx`:
  - Remove persistent assistant column from the content flow; keep sidebar on the left.
  - Change `AssistantSidebar` to open as a sheet/modal overlay anchored to the right (no width reservation when closed).
- Update `src/components/assistant/assistant-sidebar.tsx`:
  - Use a `Sheet`/`Dialog` pattern; overlay over dashboard content; closeable.
  - Trigger via the “AI Assistant” button; no permanent blank space remains.

### 3) Credentials Display After User Creation
- Switch Super Admin user creation to the enhanced API with auto-generation:
  - Update `src/app/dashboard/user-management/page.tsx` to call `POST /api/users/enhanced` with `autoGenerateCredentials: true`.
  - On success, read `tempCredentialsId` from response and fetch `GET /api/users/enhanced?tempCredentials=...`.
  - Render the existing `src/components/users/credentials-display.tsx` in a dialog for 30 seconds.
- Keep legacy `/api/users` for non-auto-generated cases.

### 4) Enforce Role Uniqueness Server-Side
- In `src/app/api/users/enhanced/route.ts`:
  - Before creating/updating, for each normalized role assignment, check if another user already holds the same role at the same scope.
  - Scopes:
    - Global unique: `PMO`, `CEO NITI`.
    - State unique: `State Advisor`, `State YP` (by `state`).
    - State+Division unique: `State Division HOD`, `Division YP` (by `state` + `branch`).
  - If a conflict is found, return 409 with the existing holder details.
- Update error handling in `user-management/page.tsx` to show a friendly toast when role assignment conflicts.

### 5) India States Fix And Data Consistency
- Already separated `Dadra and Nagar Haveli` and `Daman and Diu` and included all states/UTs:
  - `src/lib/data.ts:80` and `src/lib/state-vertical-config.ts` updated.
- Ensure state dropdowns source `STATES` and/or `getAllStates()`.

### 6) Verification
- Test dark mode toggle: all dashboards respect theme colors.
- Confirm full-width dashboards: no blank space on the right when assistant is closed; assistant opens as overlay.
- Create a user via Super Admin: credentials dialog appears and auto-hides after 30 seconds.
- Attempt to assign a role held by someone else: API rejects with 409; UI toast shows human-friendly error.

### Notes
- No secrets will be logged or changed.
- Changes remain consistent with existing component/style conventions and shadcn UI patterns.

Please confirm, and I will implement these changes with code edits and verify in the running app.