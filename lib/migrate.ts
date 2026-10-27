import "server-only";
import { db } from "./db";
import { SCHEMA_STATEMENTS } from "./schema.sql";

// Additive-only migrations. Never drop or rename anything here:
// preview deployments share the production database.
const ONBOARDING_STATEMENTS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT CHECK (account_type IN ('project','creator'))`,
  `CREATE TABLE IF NOT EXISTS creator_profiles (
    user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name    TEXT NOT NULL,
    bio             TEXT NOT NULL CHECK (char_length(bio) <= 100),
    platforms       JSONB NOT NULL,
    main_handle     TEXT NOT NULL,
    main_platform   TEXT NOT NULL,
    niches          TEXT[] NOT NULL,
    audience_band   TEXT NOT NULL,
    region          TEXT NOT NULL,
    languages       TEXT NOT NULL,
    collab_status   TEXT NOT NULL,
    telegram        TEXT NOT NULL,
    verified        BOOLEAN NOT NULL DEFAULT false,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS project_profiles (
    user_id           BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    project_name      TEXT NOT NULL,
    website           TEXT NOT NULL,
    x_handle          TEXT NOT NULL,
    category          TEXT NOT NULL,
    chains            TEXT[] NOT NULL,
    stage             TEXT NOT NULL,
    token_contract    TEXT,
    funding_stage     TEXT NOT NULL,
    backers           TEXT,
    team_size         TEXT NOT NULL,
    budget_band       TEXT NOT NULL,
    contact_name      TEXT NOT NULL,
    contact_role      TEXT NOT NULL,
    contact_email     TEXT NOT NULL,
    contact_telegram  TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS project_workspace (
    user_id            BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    goals              TEXT[],
    key_date           DATE,
    key_date_note      TEXT,
    blocker            TEXT,
    success_90d        TEXT,
    goals_done_at      TIMESTAMPTZ,
    marketing_owner    TEXT,
    channels           TEXT[],
    x_followers_band   TEXT,
    community_band     TEXT,
    tried              TEXT[],
    marketing_done_at  TIMESTAMPTZ,
    wanted_tools       TEXT[],
    payment_pref       TEXT,
    buying_done_at     TIMESTAMPTZ,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

// Linked email and password reset by email.
const EMAIL_STATEMENTS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`,
  // A confirmed email belongs to one account only.
  `CREATE UNIQUE INDEX IF NOT EXISTS users_verified_email_idx ON users (lower(email)) WHERE email_verified_at IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS email_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose     TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
    token_hash  TEXT NOT NULL UNIQUE,
    email       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS email_tokens_user_idx ON email_tokens(user_id, purpose)`,
  // X account a creator connected through X login. No X tokens are kept.
  `CREATE TABLE IF NOT EXISTS x_accounts (
    user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    x_user_id     TEXT NOT NULL UNIQUE,
    username      TEXT NOT NULL,
    followers     INT,
    connected_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

// Account security: 2FA replay guard, recovery codes, device list and activity log.
const SECURITY_STATEMENTS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip TEXT`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS recovery_codes (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at     TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS recovery_codes_user_idx ON recovery_codes(user_id)`,
  `CREATE TABLE IF NOT EXISTS security_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    ip          TEXT,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS security_events_user_idx ON security_events(user_id, created_at DESC)`,
];

let pending: Promise<void> | null = null;

/** Brings the schema up to date. Runs at most once per server instance. */
export function ensureSchema(): Promise<void> {
  pending ??= (async () => {
    const sql = db();
    // Base tables first (also idempotent), so a fresh database works before /setup has run.
    for (const stmt of [...SCHEMA_STATEMENTS, ...ONBOARDING_STATEMENTS, ...EMAIL_STATEMENTS, ...SECURITY_STATEMENTS]) await sql.unsafe(stmt);
  })().catch((err) => {
    pending = null; // let the next request retry
    throw err;
  });
  return pending;
}
