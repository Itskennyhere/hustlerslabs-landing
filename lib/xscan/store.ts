import "server-only";
import { q } from "../db";
import { ensureSchema } from "../migrate";
import type { ScanStore } from "./service";
import type { ScanResult } from "./types";

// Quota rows are only needed for today; older ones are cleared now and then.
const QUOTA_KEEP_DAYS = 2;

export const pgScanStore: ScanStore = {
  async getCached(handle) {
    await ensureSchema();
    const rows = await q<{ result: ScanResult }>`
      SELECT result FROM x_scan_cache
      WHERE handle = ${handle.toLowerCase()} AND scanned_at > now() - interval '24 hours'`;
    return rows[0]?.result ?? null;
  },

  async putCached(handle, result) {
    await q`INSERT INTO x_scan_cache (handle, result, scanned_at)
            VALUES (${handle.toLowerCase()}, ${JSON.stringify(result)}::jsonb, now())
            ON CONFLICT (handle) DO UPDATE SET result = EXCLUDED.result, scanned_at = now()`;
    if (Math.random() < 0.05) await q`DELETE FROM x_scan_cache WHERE scanned_at < now() - interval '2 days'`;
  },

  async used(userId, day) {
    await ensureSchema();
    const rows = await q<{ used: number }>`SELECT used FROM x_scan_quota WHERE user_id = ${userId} AND kl_date = ${day}`;
    return Number(rows[0]?.used ?? 0);
  },

  async reserve(userId, day, limit) {
    await ensureSchema();
    // One statement, so two scans at once cannot both get through.
    const rows = await q<{ used: number }>`
      INSERT INTO x_scan_quota (user_id, kl_date, used) VALUES (${userId}, ${day}, 1)
      ON CONFLICT (user_id, kl_date) DO UPDATE SET used = x_scan_quota.used + 1, updated_at = now()
      WHERE x_scan_quota.used < ${limit}
      RETURNING used`;
    if (Math.random() < 0.05) {
      await q`DELETE FROM x_scan_quota WHERE kl_date < ${day}::date - ${QUOTA_KEEP_DAYS}::int`;
    }
    return rows[0] ? Number(rows[0].used) : null;
  },

  async release(userId, day) {
    await q`UPDATE x_scan_quota SET used = GREATEST(used - 1, 0), updated_at = now()
            WHERE user_id = ${userId} AND kl_date = ${day}`;
  },
};
