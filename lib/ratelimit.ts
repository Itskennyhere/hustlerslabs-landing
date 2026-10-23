import "server-only";
import { headers } from "next/headers";
import { q } from "./db";

export async function clientIp(): Promise<string> {
  const h = await headers();
  // On Vercel, x-forwarded-for is set by the platform; the first entry is the client.
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** True if this bucket has hit `max` recorded failures within `windowMinutes`. */
export async function isLimited(bucket: string, max: number, windowMinutes = 15): Promise<boolean> {
  const rows = await q<{ n: number }>`
    SELECT count(*)::int AS n FROM auth_attempts
    WHERE bucket = ${bucket} AND created_at > now() - make_interval(mins => ${windowMinutes})`;
  return (rows[0]?.n ?? 0) >= max;
}

export async function recordFailure(...buckets: string[]): Promise<void> {
  for (const b of buckets) await q`INSERT INTO auth_attempts (bucket) VALUES (${b})`;
  // Opportunistic cleanup of old rows.
  if (Math.random() < 0.05) await q`DELETE FROM auth_attempts WHERE created_at < now() - interval '1 day'`;
}

export async function clearFailures(bucket: string): Promise<void> {
  await q`DELETE FROM auth_attempts WHERE bucket = ${bucket}`;
}
