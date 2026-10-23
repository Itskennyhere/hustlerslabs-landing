// Idempotent schema. Run once from /setup; safe to run again.
export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS invites (
    id            BIGSERIAL PRIMARY KEY,
    key_hash      TEXT NOT NULL UNIQUE,
    label         TEXT,
    created_by    BIGINT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    used_at       TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id               BIGSERIAL PRIMARY KEY,
    username         TEXT NOT NULL UNIQUE,
    password_hash    TEXT NOT NULL,
    role             TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
    invite_id        BIGINT REFERENCES invites(id),
    totp_secret_enc  TEXT,
    totp_enabled     BOOLEAN NOT NULL DEFAULT false,
    disabled_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at    TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id             BIGSERIAL PRIMARY KEY,
    token_hash     TEXT NOT NULL UNIQUE,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mfa_verified   BOOLEAN NOT NULL DEFAULT false,
    mfa_attempts   INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS auth_attempts (
    id          BIGSERIAL PRIMARY KEY,
    bucket      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS auth_attempts_bucket_idx ON auth_attempts(bucket, created_at)`,
];
