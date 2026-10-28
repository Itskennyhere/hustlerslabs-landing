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
    bio             TEXT NOT NULL,
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
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip TEXT`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`,
  // Which sign-in step a pending session is on ('totp' or 'email'), and the admin email code.
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS stage TEXT`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS email_code_hash TEXT`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS email_code_expires_at TIMESTAMPTZ`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS email_code_sends INT NOT NULL DEFAULT 0`,
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

// Creator numbers, bio length, reserved X columns, intro requests.
const ROSTER_STATEMENTS = [
  // Member number: taken once from the sequence when the profile row is created, never changed.
  `CREATE SEQUENCE IF NOT EXISTS creator_no_seq`,
  `ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS creator_no INT NOT NULL DEFAULT nextval('creator_no_seq')`,
  `CREATE UNIQUE INDEX IF NOT EXISTS creator_profiles_creator_no_idx ON creator_profiles(creator_no)`,
  // Bio up to 160 characters (the same as an X bio). Replaces the earlier 100-character check.
  `ALTER TABLE creator_profiles DROP CONSTRAINT IF EXISTS creator_profiles_bio_check`,
  `DO $$ BEGIN
     ALTER TABLE creator_profiles ADD CONSTRAINT creator_profiles_bio_len CHECK (char_length(bio) <= 160);
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  // Reserved for syncing from X later. Left empty for now.
  `ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS x_user_id TEXT UNIQUE`,
  `ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS x_photo_url TEXT`,
  `ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS x_bio TEXT`,
  `ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS x_followers INT`,
  `ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS x_synced_at TIMESTAMPTZ`,
  `ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS audience_source TEXT NOT NULL DEFAULT 'self' CHECK (audience_source IN ('self','x'))`,
  `CREATE TABLE IF NOT EXISTS intro_requests (
    id               BIGSERIAL PRIMARY KEY,
    project_user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note             TEXT CHECK (char_length(note) <= 500),
    status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','introduced','declined')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_user_id, creator_user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS intro_requests_status_idx ON intro_requests(status, created_at DESC)`,
];

// Open sign-up with approval, and admin-only keys.
const APPROVAL_STATEMENTS = [
  // Accounts that exist when this column is added count as approved (the default fills them once);
  // the default is then dropped, so every new sign-up starts unapproved.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT now()`,
  `ALTER TABLE users ALTER COLUMN approved_at DROP DEFAULT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by BIGINT`,
  // Keys now only create admin accounts. Keys made before this have no kind and no longer work.
  `ALTER TABLE invites ADD COLUMN IF NOT EXISTS kind TEXT`,
  // The owner: one admin with full control, claimed once with OWNER_CLAIM_TOKEN.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_one_owner_idx ON users (is_owner) WHERE is_owner`,
];

let pending: Promise<void> | null = null;

/** Brings the schema up to date. Runs at most once per server instance. */
export function ensureSchema(): Promise<void> {
  pending ??= (async () => {
    const sql = db();
    // Base tables first (also idempotent), so a fresh database works before /setup has run.
    for (const stmt of [...SCHEMA_STATEMENTS, ...ONBOARDING_STATEMENTS, ...EMAIL_STATEMENTS, ...SECURITY_STATEMENTS, ...ROSTER_STATEMENTS, ...APPROVAL_STATEMENTS]) await sql.unsafe(stmt);
  })().catch((err) => {
    pending = null; // let the next request retry
    throw err;
  });
  return pending;
}
