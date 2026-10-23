# Members area

Private, invite-only area behind the public site.

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/login` | Anyone | Sign in |
| `/join` | Anyone with an invite key | Create account with own username and password |
| `/members` | Members | Members home |
| `/members/tools` | Members | Tools (empty for now) |
| `/members/account` | Members | Two-step login, change password |
| `/admin` | Admin only | Generate invite keys, revoke keys, sign out or disable members |
| `/setup` | Once | Creates the admin account, then returns 404 forever |

The public landing page and blog in `public/` are served exactly as before.

## Security

- Passwords hashed with Argon2id. Invite keys and session tokens stored only as SHA-256 hashes.
- Invite keys: single use, expire (24h, 48h or 7 days), revocable. Burned and account created in one atomic statement.
- Sessions: random 256-bit token in a `__Host-` httpOnly, Secure, SameSite cookie. Checked against the database on every protected page and every action.
- Two-step login (authenticator app), required for the admin before invite keys can be generated. 2FA secrets encrypted at rest (AES-256-GCM).
- Rate limits: 5 failed logins per username and 20 per IP per 15 minutes. Invite and 2FA attempts limited too.
- Disabling a member signs them out instantly. Changing password signs out other devices.
- Private pages: noindex, no-store, cannot be framed.

## Environment variables (Vercel > Project > Settings > Environment Variables)

- `DATABASE_URL`: added automatically by connecting a Neon Postgres database (Vercel > Storage).
- `AUTH_SECRET`: 32+ random characters. Never change it after setup or 2FA stops working.
- `ADMIN_SETUP_TOKEN`: one-time token for `/setup`.

## Adding a tool later

Create `app/members/tools/<name>/page.tsx` and start it with `await requireMember();`.
