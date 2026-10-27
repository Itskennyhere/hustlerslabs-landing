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
| `/join` | Anyone with an invite key | Multi-step sign-up: account type, invite key, username, email and password, project details (projects only). Email is required and a confirm link is sent |
| `/members` | Members | Home. Creators see their card. Projects see the workspace checklist |
| `/members/profile` | Creators | Set up or edit the creator card, and Connect X. Creators without a card are sent here from every other `/members` page |
| `/members/profile/saved` | Creators | Shown after the first profile save: "Your card is live." with the card, a Telegram privacy note, Edit profile and Go to home |
| `/members/profile/x/start`, `/members/profile/x/callback` | Creators | Connect X (X login). Only reads the X id, username and follower count, then revokes the X token |
| `/members/workspace` | Projects | Workspace checklist and progress (0/3 to 3/3) |
| `/members/workspace/goals`, `/marketing`, `/buying` | Projects | One section each, saved separately, editable later |
| `/members/tools` | Members | Tools. Locked for projects until the workspace is 3/3 |
| `/members/creators` | Projects (workspace 3/3) and admins | Creator roster: verified creators who take collabs, newest verified first. Filters for niche, audience, collab status and region in the URL. Request intro with an optional note (one per creator, 20 a day per project). Never shows Telegram. Creators and other members get a 404 |
| `/members/account` | Members | Linked email, two-step login, change password. Projects also edit their sign-up answers here |
| `/admin` | Admin only | Invite keys, members with type and workspace progress |
| `/admin/members/[id]` | Admin only | Everything a member answered. Creators: card, Telegram, Verify / Unverify |
| `/admin/creators` | Admin only | Creator roster with filters (niche, audience, collab status, region). Filters live in the URL |
| `/admin/intros` | Admin only | Intro requests (project, creator with Telegram, note, date) with a status per row: New, Contacted, Introduced, Declined. New ones first. The number of new requests shows beside the Admin link |
| `/admin/insights` | Admin only | Counts of tools requested, payment preference, budget and goals |
| `/setup` | Once | Creates the admin account, then returns 404 forever |

The public landing page and blog in `public/` are served exactly as before.

Until a member confirms their email, a banner under the nav (members area and admin) reminds them, with a link to Account to resend or change it.

Every page under `/members` except `/members/profile` lives in the `app/members/(main)/` route group. The group's layout is what redirects creators without a card. Route groups do not change URLs.

## Database

Tables: `invites`, `users`, `sessions`, `auth_attempts` (from `/setup`), plus:

- `users.account_type`: `project`, `creator`, or empty (admin and anyone from before onboarding).
- `creator_profiles`: one row per creator. `telegram` is private: never shown on the card, only in admin views. `verified` is set by an admin. `creator_no` is the member number (`No. 0042`), taken from the `creator_no_seq` sequence when the row is created and never changed. Bio is up to 160 characters. `x_user_id`, `x_photo_url`, `x_bio`, `x_followers`, `x_synced_at` and `audience_source` are reserved for syncing from X later and are empty for now.
- `intro_requests`: a project asking to meet a creator. One row per project and creator (`UNIQUE`), note up to 500 characters, status `new`, `contacted`, `introduced` or `declined`.
- `project_profiles`: sign-up answers, one row per project.
- `project_workspace`: workspace answers, one row per project. Each section sets its own `*_done_at` when first saved.
- `users.email`, `users.email_verified_at`: the linked email. Only a confirmed email is used, and a confirmed email belongs to one account.
- `email_tokens`: single-use confirm and reset links. Only the SHA-256 of each token is stored.
- `x_accounts`: the X account a creator connected (X user id, username, followers). One X account per member. No X tokens are stored. The card marks that X link as connected and uses it for the photo.

`lib/migrate.ts` (`ensureSchema()`) creates and updates these. It is additive only (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), runs at most once per server instance, and is called from the `/join` action and the `/members` and `/admin` layouts. Preview deployments share the production database, so never drop or rename anything there; add new columns instead.

## Editing option lists

Every choice list (niches, chains, budgets, goals, tools and so on) is in `lib/onboarding-options.ts`. Forms render from it and the server validates against it.

- Changing a **label** is safe.
- Adding an option is safe.
- Do not change or remove a **value** that is already in use: it is stored in the database. If you must retire one, keep the value and change its label.

Limits (max goals, max tools, platform rows, intro note length, intros per day) are in the same file, as are the card's collab text (`COLLAB_CARD_TEXT`), the roster's collab filter (`ROSTER_COLLAB`) and the intro statuses (`INTRO_STATUS`). Field length rules are in `lib/validate.ts`.

## Security

- Passwords hashed with Argon2id. Invite keys and session tokens stored only as SHA-256 hashes.
- Invite keys: single use, expire (24h, 48h or 7 days), revocable. Burning the invite, creating the user and creating the profile happen in one transaction: if any part fails, nothing is written and the invite still works.
- Sessions: random 256-bit token in a `__Host-` httpOnly, Secure, SameSite cookie. Checked against the database on every protected page and every action. Members stay signed in for 7 days, admins for 12 hours. Each session records its IP and browser for the device list.
- Every member action reads and writes only the signed-in user's own rows. Ids are never taken from the form. Admin actions require the admin role.
- All onboarding input is validated on the server against the option lists, with length limits, email, https and contract address checks.
- Password reset by email: only to a confirmed email. The answer on `/login/forgot` is the same whether or not the account exists, and the email is sent after the response. Limited to 5 requests per IP per 15 minutes and 3 emails per account per hour. A reset signs out every device, emails a notice, and does not turn off two-step login.
- Two-step login (authenticator app). **Required for admins**: an admin without it is sent to Account and cannot open `/admin` or turn it off. 2FA secrets encrypted at rest (AES-256-GCM).
- Each 2FA code works once (`users.totp_last_step`), so a code seen over someone's shoulder or phished cannot be replayed.
- Wrong 2FA codes are counted per account, not per sign-in: 5 per sign-in attempt, 10 per account per 15 minutes. Knowing the password does not give unlimited guesses.
- Recovery codes: 10 one-time codes shown once when 2FA is turned on (only SHA-256 hashes stored, table `recovery_codes`). Usable on the code screen if the phone is lost. New codes can be made from Account.
- Sensitive changes need the current password again: changing email, turning off 2FA, making new recovery codes, changing password. Turning off 2FA and new recovery codes also need a current code.
- Signed-in devices on Account: browser, IP, sign-in and last active time. Sign out one device or all others. A member can only sign out their own sessions.
- Security activity log (table `security_events`): sign-ins, password, 2FA, recovery code, email and device changes, with IP and browser. Members see their last 10 on Account; admins see the last 15 on each member's page.
- Alert emails to the confirmed address: sign-in from a new device or network, recovery code used, password changed, 2FA on or off, new recovery codes. When the email changes, the **old** address is told.
- New passwords are checked against Have I Been Pwned (k-anonymity: only the first 5 characters of a SHA-1 hash leave the server). Breached passwords are refused at sign-up, change, reset and setup. If the service is down, the check is skipped rather than blocking people.
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
- `PWNED_API_BASE` (optional, tests only): overrides the breach check address.
- `X_CLIENT_ID`, `X_CLIENT_SECRET`: for Connect X. Without them the Connect X panel is hidden.
- `MAIL_FROM` (optional): sender shown on emails. Defaults to `Hustlers Labs <SMTP_USER>`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (optional): only to use something other than Gmail.

Without `SMTP_USER` and `SMTP_PASS`, linking an email and password reset show a "not set up yet" message.

## Setting up Connect X

1. Go to https://developer.x.com, sign in, and create a Project and an App (the free tier is enough).
2. In the App, open **User authentication settings** and click Set up:
   - App permissions: **Read**.
   - Type of App: **Web App, Automated App or Bot** (a confidential client).
   - Callback URI: `https://www.hustlerslabs.com/members/profile/x/callback`.
   - Website URL: `https://www.hustlerslabs.com`.
3. Copy the **OAuth 2.0 Client ID and Client Secret** (not the API key and secret) into Vercel as `X_CLIENT_ID` and `X_CLIENT_SECRET`.

Links in emails and the X callback use `APP_URL` (default `https://www.hustlerslabs.com`), so on a preview deployment Connect X returns to the live site.

## Adding a tool later

Create `app/members/(main)/tools/<name>/page.tsx` and start it with `await requireMember();`. For projects, check the workspace is complete the same way `app/members/(main)/tools/page.tsx` does.
