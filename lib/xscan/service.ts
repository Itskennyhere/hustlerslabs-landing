import { ScanError } from "./errors";
import { DAILY_SCAN_LIMIT, klDate, quotaStatus } from "./quota";
import type { QuotaStatus, ScanResponse, ScanResult } from "./types";

/** Where quota counts and cached results live. Postgres in the app, a map in tests. */
export interface ScanStore {
  /** A result for this handle from the last 24 hours, if any. */
  getCached(handle: string): Promise<ScanResult | null>;
  putCached(handle: string, result: ScanResult): Promise<void>;
  used(userId: number, day: string): Promise<number>;
  /** Atomically takes one scan. Returns the new count, or null if the limit is already reached. */
  reserve(userId: number, day: string, limit: number): Promise<number | null>;
  /** Gives one scan back. */
  release(userId: number, day: string): Promise<void>;
}

export type ScanRequest = {
  store: ScanStore;
  userId: number;
  isAdmin: boolean;
  handle: string;
  scan: (handle: string) => Promise<ScanResult>;
  now?: Date;
};

export type ServiceResult =
  | { status: 200; body: ScanResponse }
  | { status: number; body: { error: string; resetsAt?: string; quota?: QuotaStatus } };

export const LIMIT_MESSAGE = "You have used today's scan. It resets at midnight, Malaysia time.";

export async function getQuota(store: ScanStore, userId: number, isAdmin: boolean, now = new Date()): Promise<QuotaStatus> {
  if (isAdmin) return quotaStatus(0, now, true);
  return quotaStatus(await store.used(userId, klDate(now)), now);
}

/** Cache first (free), then the daily quota, then the paid Sorsa and Anthropic calls. */
export async function runScan({ store, userId, isAdmin, handle, scan, now = new Date() }: ScanRequest): Promise<ServiceResult> {
  const cached = await store.getCached(handle);
  if (cached) {
    return { status: 200, body: { result: cached, cached: true, quota: await getQuota(store, userId, isAdmin, now) } };
  }

  // The quota day is fixed when the scan starts, so a scan that crosses midnight is released on the right day.
  const day = klDate(now);
  let quota: QuotaStatus;
  if (isAdmin) {
    quota = quotaStatus(0, now, true);
  } else {
    const used = await store.reserve(userId, day, DAILY_SCAN_LIMIT);
    if (used === null) {
      const full = quotaStatus(DAILY_SCAN_LIMIT, now);
      return { status: 429, body: { error: LIMIT_MESSAGE, resetsAt: full.resetsAt, quota: full } };
    }
    quota = quotaStatus(used, now);
  }

  try {
    const result = await scan(handle);
    await store.putCached(handle, result);
    return { status: 200, body: { result, cached: false, quota } };
  } catch (err) {
    if (!isAdmin) await store.release(userId, day);
    const restored = await getQuota(store, userId, isAdmin, now);
    if (err instanceof ScanError) {
      return { status: err.status, body: { error: err.message, quota: restored } };
    }
    console.error("X scan failed", err);
    return { status: 500, body: { error: "Something went wrong on our side. Your scan was not used.", quota: restored } };
  }
}
