import type { QuotaStatus } from "./types";

// Successful scans each account gets per Malaysia day. One quota per account, shared by creators and projects.
export const DAILY_SCAN_LIMIT = 1;

const KL_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Calendar date in Asia/Kuala_Lumpur (UTC+8, no daylight saving), as YYYY-MM-DD. */
export function klDate(now: Date): string {
  return new Date(now.getTime() + KL_OFFSET_MS).toISOString().slice(0, 10);
}

/** The next midnight in Kuala Lumpur, when the quota resets. */
export function nextKlMidnight(now: Date): Date {
  const kl = new Date(now.getTime() + KL_OFFSET_MS);
  return new Date(Date.UTC(kl.getUTCFullYear(), kl.getUTCMonth(), kl.getUTCDate() + 1) - KL_OFFSET_MS);
}

export function quotaStatus(used: number, now: Date, unlimited = false): QuotaStatus {
  return {
    unlimited,
    limit: DAILY_SCAN_LIMIT,
    remaining: unlimited ? DAILY_SCAN_LIMIT : Math.max(0, DAILY_SCAN_LIMIT - used),
    resetsAt: nextKlMidnight(now).toISOString(),
  };
}
