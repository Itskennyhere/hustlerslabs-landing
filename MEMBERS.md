# Members area: short guide

Invite-only members area on Next.js (App Router), Postgres (Neon) and plain CSS. The public landing page and blog are static files in `public/` and are served as before.

## Pages and who can see them

**Anyone**

| Page | What |
| --- | --- |
| `/login` | Sign in with email or username, and password |
| `/login/verify` | Authenticator app code, or a recovery code |
| `/login/email-code` | Admins only, when email is set up and the admin has a confirmed email: a 6-digit code sent by email |
| `/login/forgot`, `/login/reset` | Password reset by email. Hidden when email is not set up |
| `/login/confirm-email` | Confirms an email from the link we send |
| `/join` | Sign-up with an invite key: account type, login details, project details (projects only) |
| `/setup` | Creates the first admin once, then returns 404 |

**Members** (every page checks the session itself)

| Page | What |
| --- | --- |
| `/members` | Home. Creators see their card; projects see the workspace checklist |
| `/members/profile` | Creators: set up or edit the creator card, Connect X (only shown when X is set up). Creators without a card are sent here |
| `/members/profile/saved` | Creators: "Your card is live." after the first save |
| `/members/workspace`, `/members/workspace/<section>` | Projects: Goals, Current marketing, Tools and payment |
| `/members/tools` | Tools. Locked for projects until the workspace is 3/3 |
| `/members/creators` | Projects with a finished workspace, and admins: verified creators, Request intro |
| `/members/account` | Settings list: two-step login, email, password, signed-in devices, recent activity, project details (projects) |
| `/members/account/<two-step, email, password, devices, activity, project>` | One page per setting |

**Admins** (role `admin`, two-step login on)

| Page | What |
| --- | --- |
| `/admin` | Overview tiles and a short Needs attention list |
| `/admin/members`, `/admin/members/<id>` | Members list (search, filters, sort) and one member: answers, card, Telegram, Sign out, Disable or Enable, Verify |
| `/admin/invites`, `/admin/invites/new` | Invite keys by status, and Generate key |
| `/admin/creators` | Creators, pending review first |
| `/admin/intros` | Intro requests by status, with a status per row |
| `/admin/insights` | What projects ask for: tools, payment, budget, goals |

List pages show 25 rows a page. Search, filters, tab, sort and page are in the URL.

## Environment variables

Set them in Vercel > Project > Settings > Environment Variables. `.env.example` lists the same with comments.

| Variable | Needed | What |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. `POSTGRES_URL` or the Neon integration's prefixed names also work |
| `AUTH_SECRET` | Yes | 32+ random characters. Encrypts 2FA secrets. Never change it |
| `ADMIN_SETUP_TOKEN` | Once | For `/setup` |
| `SMTP_USER`, `SMTP_PASS` | For email | Gmail address and a Google app password. Without them, email features are off: no reset, no alerts, no admin email code |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `MAIL_FROM`, `APP_URL` | No | Mail server (defaults to Gmail), sender, and the base address for links (defaults to https://www.hustlerslabs.com) |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | For Connect X | From an X developer app (Web App, Read, callback `https://www.hustlerslabs.com/members/profile/x/callback`). Without them Connect X is hidden |
| `X_AUTH_BASE`, `X_API_BASE`, `PWNED_API_BASE` | No | Tests only |

## Security in brief

- Argon2id passwords; breached passwords refused. Sessions are random tokens stored as hashes, in a `__Host-` cookie. Members stay signed in 7 days, admins 12 hours.
- Two-step login with an app, one-time recovery codes, codes usable once, wrong codes limited per account. Required for admins.
- Admins also get an emailed code at sign-in once email is set up and their email is confirmed. Nothing blocks the admin before that: a banner asks them to set it up.
- Changing the password or email, or turning off 2FA, needs the current password and a 2FA code. A password change signs out other devices.
- Alerts by email for new-device sign-ins and security changes. Activity log on Account and on each member's admin page.
- Every page and server action checks the session and role itself. Members only read and write their own rows. All SQL goes through the `q` helper with bound parameters.

## Database

`lib/migrate.ts` (`ensureSchema()`) brings the schema up to date on first request. It only adds (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and is safe to run any number of times. Preview deployments share the production database, so never drop or rename anything.

Tables: `users`, `invites`, `sessions`, `auth_attempts`, `email_tokens`, `security_events`, `recovery_codes`, `creator_profiles`, `project_profiles`, `project_workspace`, `intro_requests`, `x_accounts`.

## Option lists

Every choice list (niches, chains, budgets, goals, tools, intro statuses and so on) and every limit (max goals, max tools, intros per day) is in `lib/onboarding-options.ts`. Forms render from it and the server validates against it. Labels are safe to change and options safe to add. Never change or remove a value that is in use, because it is stored in the database.

## Adding a tool page

1. Create `app/members/(main)/tools/<name>/page.tsx`. Start it with `const s = await requireMember();`.
2. For projects, keep the workspace lock: `if ((await getAccountType(s.userId)) === "project" && !(await workspaceComplete(s.userId))) redirect("/members/tools");`.
3. Read and write only the signed-in user's rows (`WHERE user_id = ${s.userId}`), with the `q` helper.
4. Add a link to it on `/members/tools`.
5. For a list, use `lib/list.ts` and `components/list.tsx` (search, filters, tabs, 25 per page, pager).
