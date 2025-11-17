## Objective
Create intuitive, short emails from names only and cover edge cases (single-name, single-letter, multi-last-names, accents, special chars) with collision-safe fallbacks. Keep first-role-only generation and add automatic rebasing when the source role is removed.

## Email Generation Rules
1. Normalize name:
   - Strip diacritics (NFKD), collapse whitespace, remove invalid characters.
   - Tokenize by spaces/hyphen/apostrophe; drop empty tokens.
2. Local part selection:
   - 0 tokens → `user####` (short numeric tail).
   - 1 token → that token; if length = 1, add two digits (e.g., `h01`).
   - ≥2 tokens → `first.last` using first token and last non-connector token.
     - Connector list: `['de','del','della','la','van','von','bin','al','da','dos']` (skip if last token is a connector; use last non-connector).
3. Constraints:
   - Allowed chars: `a-z 0-9 . -` only; trim dots; cap local to 32 chars; ensure length ≥ 2.
4. Uniqueness:
   - If collision, append short numeric suffix: `firstname.lastname2@domain`.
5. Domain:
   - Use `process.env.EMAIL_DOMAIN || 'visitwise.in'`.
6. Password:
   - `Firstname@1234` for dev; production may use secure random generator.

## Fallback Mechanisms
- First role only: generate credentials once when the user receives their first role and has none.
- Role removal/revision:
  - Track `credentialSourceRole` at mint time.
  - If the source role is no longer present, rebase email using name-only rule and ensure uniqueness; keep password unchanged.
- Optional: reserved names protection list (e.g., `admin`, `support`).

## Code Changes
1. `src/lib/user-credential-generator.ts`
   - Implement robust `generateUserCredentials(name)` per rules above.
   - Implement `generateUniqueUserCredentials(name, existingEmails)` that applies collision suffix.
   - Read domain from `EMAIL_DOMAIN` env.
2. `src/app/api/users/enhanced/route.ts`
   - Creation (no roles): do not assign placeholder email/password.
   - On first role assignment in POST/PATCH: use `generateUniqueUserCredentials(name, existingEmails)`.
   - Persist `credentialSourceRole` and `credentialLockedAt` at mint time.
   - On PATCH, if `credentialSourceRole` is missing from updated roles, rebase email via generator.
3. `src/models/user.ts`
   - Ensure fields exist: `credentialSourceRole`, `credentialLockedAt`.
4. Dashboard UI `src/app/dashboard/user-management/page.tsx`
   - Create user by name only.
   - Table header shows Name primary, Email secondary (already aligned).
   - “Show Credentials” fetches the last temp credential ID only.

## Edge Case Examples
- `Harsh` → `harsh@domain`
- `A` → `a01@domain`
- `Juan de la Cruz Álvarez` → `juan.alvarez@domain`
- `X Æ A-12` → `x-a-12@domain` (sanitized)
- Empty/whitespace → `user####@domain`

## Verification
1. Seed dev users, add a user named `Harsh` and assign first role → email `harsh@domain`.
2. Add `A` and assign first role → email `a01@domain` (or `a@domain` if unique and length ≥ 2).
3. Add `Juan de la Cruz Álvarez` → `juan.alvarez@domain`.
4. Role removal: remove the role used to mint credentials → email rebases to the name-only pattern; password unchanged.
5. Collisions: create two `Harsh` users → second becomes `harsh2@domain`.

## Notes
- No plus tags or long emails; short numeric suffix only when needed.
- Keep first-role-only generation and 30-second temp display window.
- Future: add auto-escalation (Thinking.txt line 357) with delayed reassignment after reject/decline.