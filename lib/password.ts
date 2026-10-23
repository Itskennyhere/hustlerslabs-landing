import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id, OWASP-recommended parameters.
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTS);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

// Used when a username does not exist, so response time does not reveal which usernames are real.
let dummy: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummy ??= hashPassword("hustlers-labs-timing-equalizer");
  await verifyPassword(await dummy, password);
}

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export function validateUsername(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(value)) {
    return { ok: false, error: "Username must be 3 to 24 characters: lowercase letters, numbers or underscores." };
  }
  return { ok: true, value };
}

export function validatePassword(password: string, username: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 128) return "Password must be 128 characters or fewer.";
  if (password.toLowerCase().includes(username.toLowerCase())) return "Password cannot contain your username.";
  if (new Set(password).size < 6) return "Password is too repetitive. Use a mix of characters.";
  return null;
}
