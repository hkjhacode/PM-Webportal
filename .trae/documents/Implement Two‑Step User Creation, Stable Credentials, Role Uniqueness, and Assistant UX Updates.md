## Goals

* Make user onboarding two-step: create user with name first, then assign roles; generate credentials only after first role assignment.

* Stop password from changing on “Show Credentials”; fetch creation-time credentials instead (expires in 30s).

* Enforce role assignment uniqueness (role+state+branch) across the system, while allowing multiple roles per user and multi-state/subject assignments.

* Refine assistant chat UX: rename "New Chat" to "New Conversation" and clear history on logout.

## Server Changes

### Enhanced Users API

1. POST `/api/users/enhanced`

   * Accept `{ name }` without email/password or roles.

   * If roles omitted or empty, create user without credentials: no `email`, no `passwordHash`.

   * If roles provided, perform uniqueness checks and generate credentials at creation; store temp credentials (30s) with `tempCredentialsId`.
2. PATCH `/api/users/enhanced`

   * Accept `{ id, roles }` to assign roles post-creation.

   * Run uniqueness checks per each role assignment: unique holder for the same `(role, state?, branch?)` across all users.

   * If the user has no credentials yet, generate unique `email` and secure `password` (>=8 chars), hash, save, and create a 30s temp credentials entry; return `tempCredentialsId`.

   * Do NOT reset password when fetching credentials; only when explicitly `resetPassword: true`.
3. GET `/api/users/enhanced?tempCredentials=<id>`

   * Return temp credentials if within 30s; otherwise 404. No regeneration.
4. Dev store parity

   * Implement the same uniqueness checks over the dev in-memory store as in MongoDB.

### Core Users API

* Keep existing GET/PATCH/DELETE behaviors; PATCH supports role updates respecting uniqueness.

### Auth

* No changes to the auth flow. Ensure `LoginSchema` min length satisfied; password generator uses `Firstname@1234`.

## Client Changes

### User Management UI (`/dashboard/user-management`)

1. Create User dialog

   * Only require `name`. Remove email/password fields for default flow.

   * POST to `/api/users/enhanced` with `{ name }`.
2. Assign roles

   * Use existing role editor to add roles. On save (PATCH), if credentials do not exist yet, API returns `tempCredentialsId`; fetch `GET /api/users/enhanced?tempCredentials=...` and display values for 30s.

   * “Show Credentials” button

     * Change to fetch-only: call `GET /api/users/enhanced?tempCredentials=<lastId>`; if expired, show "Credentials expired" message; do not `resetPassword` unless explicitly requested.
3. Role uniqueness UX

   * When API returns 409 holder conflict, show who holds it and prevent duplicate assignment.

### Assistant Sidebar

* Rename the button from "New Chat" to "New Conversation".

* On logout (`user` becomes null), clear local storage for `chat:<user.id>`.

* Titles already auto-derive from first message; keep this behavior.

## Verification

1. Run dev server (`npm run dev`) and seed dev users via `Reset Dev Users`.
2. Create a new user with only name. Confirm no email/password set.
3. Assign roles to the user; confirm credentials are generated once, temp credentials appear for 30s, and login works with those credentials.
4. Attempt assigning the same `(role, state, branch)` to another user; expect 409 conflict with holder details.
5. Click “Show Credentials” repeatedly within 30s; password remains stable; after 30s, credentials return 404.
6. Logout and verify assistant conversations are cleared; button reads "New Conversation".

## Deliverables

* Updated APIs supporting two-step onboarding and stable temp credentials.

* Updated UI for user creation, role assignment, and credential display.

* Assistant UX polish for naming and logout behavior.

