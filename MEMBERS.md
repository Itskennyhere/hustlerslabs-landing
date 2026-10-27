# Members area

Private, invite-only area behind the public site.

## Account types

Everyone who signs up at `/join` picks one:

- **Creator** (free). Sets up a creator card at `/members/profile`. This is the Hustlers Labs creator roster.
- **Project** (future paying customer). Answers project questions at sign-up, then completes a three-part workspace inside. Tools stay locked until the workspace is complete.

The admin account has no type.

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/login` | Anyone | Sign in |
| `/login/forgot` | Anyone | Forgot password: emails a reset link to the account's confirmed email |
| `/login/reset` | Anyone with a reset link | Choose a new password (link works once, 30 minutes) |
| `/login/confirm-email` | Anyone with a confirm link | Confirms the email linked in Account (link works once, 24 hours) |
| `/join` | Anyone with an invite key | Multi-step sign-up: account type, invite key and login, project details (projects only) |
| `/members` | Members | Home. Creators see their card. Projects see the workspace checklist |
| `/members/profile` | Creators | Set up or edit the creator card. Creators without a card are sent here from every other `/members` page |
| `/members/workspace` | Projects | Workspace checklist and progress (0/3 to 3/3) |
| `/members/workspace/goals`, `/marketing`, `/buying` | Projects | One section each, saved separately, editable later |
| `/members/tools` | Members | Tools. Locked for projects until the workspace is 3/3 |
| `/members/account` | Members | Linked email, two-step login, change password. Projects also edit their sign-up answers here |
| `/admin` | Admin only | Invite keys, members with type and workspace progress |
| `/admin/members/[id]` | Admin only | Everything a member answered. Creators: card, Telegram, Verify / Unverify |
| `/admin/creators` | Admin only | Creator roster with filters (niche, audience, collab status, region). Filters live in the URL |
| `/admin/insights` | Admin only | Counts of tools requested, payment preference, budget and goals |
| `/setup` | Once | Creates the admin account, then returns 404 forever |

The public landing page and blog in `public/` are served exactly as before.

Every page under `/members` except `/members/profile` lives in the `app/members/(main)/` route group. The group's layout is what redirects creators without a card. Route groups do not change URLs.

## Database

Tables: `invites`, `users`, `sessions`, `auth_attempts` (from `/setup`), plus:

- `users.account_type`: `project`, `creator`, or empty (admin and anyone from before onboarding).
- `creator_profiles`: one row per creator. `telegram` is private: never shown on the card, only in admin views. `verified` is set by an admin.
- `project_profiles`: sign-up answers, one row per project.
- `project_workspace`: workspace answers, one row per project. Each section sets its own `*_done_at` when first saved.
- `users.email`, `users.email_verified_at`: the linked email. Only a confirmed email is used, and a confirmed email belongs to one account.
- `email_tokens`: single-use confirm and reset links. Only the SHA-256 of each token is stored.

`lib/migrate.ts` (`ensureSchema()`) creates and updates these. It is additive only (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), runs at most once per server instance, and is called from the `/join` action and the `/members` and `/admin` layouts. Preview deployments share the production database, so never drop or rename anything there; add new columns instead.

## Editing option lists

Every choice list (niches, chains, budgets, goals, tools and so on) is in `lib/onboarding-options.ts`. Forms render from it and the server validates against it.

- Changing a **label** is safe.
- Adding an option is safe.
- Do not change or remove a **value** that is already in use: it is stored in the database. If you must retire one, keep the value and change its label.

Limits (max goals, max tools, platform rows) are in the same file. Field length rules are in `lib/validate.ts`.

## Security

- Passwords hashed with Argon2id. Invite keys and session tokens stored only as SHA-256 hashes.
- Invite keys: single use, expire (24h, 48h or 7 days), revocable. Burning the invite, creating the user and creating the profile happen in one transaction: if any part fails, nothing is written and the invite still works.
- Sessions: random 256-bit token in a `__Host-` httpOnly, Secure, SameSite cookie. Checked against the database on every protected page and every action.
- Every member action reads and writes only the signed-in user's own rows. Ids are never taken from the form. Admin actions require the admin role.
- All onboarding input is validated on the server against the option lists, with length limits, email, https and contract address checks.
- Password reset by email: only to a confirmed email. The answer on `/login/forgot` is the same whether or not the account exists, and the email is sent after the response. Limited to 5 requests per IP per 15 minutes and 3 emails per account per hour. A reset signs out every device, emails a notice, and does not turn off two-step login.
- Two-step login (authenticator app), required for the admin before invite keys can be generated. 2FA secrets encrypted at rest (AES-256-GCM).
- Rate limits: 5 failed logins per username and 20 per IP per 15 minutes. Invite and 2FA attempts limited too.
- Disabling a member signs them out instantly. Changing password signs out other devices.
- Private pages: noindex, no-store, cannot be framed.

## Environment variables (Vercel > Project > Settings > Environment Variables)

- `DATABASE_URL`: added automatically by connecting a Neon Postgres database (Vercel > Storage). The app also reads `POSTGRES_URL` and the `hustlerslabs_members_`-prefixed names the Neon integration created.
- `AUTH_SECRET`: 32+ random characters. Never change it after setup or 2FA stops working.
- `ADMIN_SETUP_TOKEN`: one-time token for `/setup`.
- `SMTP_USER`: the Gmail address that sends email.
- `SMTP_PASS`: a Google app password for that Gmail (Google Account > Security > 2-Step Verification > App passwords). Not the normal Gmail password.
- `APP_URL` (optional): base for links in emails. Defaults to `https://www.hustlerslabs.com`.
- `MAIL_FROM` (optional): sender shown on emails. Defaults to `Hustlers Labs <SMTP_USER>`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (optional): only to use something other than Gmail.

Without `SMTP_USER` and `SMTP_PASS`, linking an email and password reset show a "not set up yet" message.

## Adding a tool later

Create `app/members/(main)/tools/<name>/page.tsx` and start it with `await requireMember();`. For projects, check the workspace is complete the same way `app/members/(main)/tools/page.tsx` does.
