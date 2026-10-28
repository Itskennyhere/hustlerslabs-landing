import assert from "node:assert/strict";
import { test } from "node:test";
import { ScanError } from "../lib/xscan/errors";
import { klDate, nextKlMidnight } from "../lib/xscan/quota";
import { getQuota, runScan, type ScanStore } from "../lib/xscan/service";
import type { ScanResult } from "../lib/xscan/types";

// 23:30 on 28 October in Kuala Lumpur.
const LATE_NIGHT_KL = new Date("2026-10-28T15:30:00Z");
// 00:00 on 29 October in Kuala Lumpur.
const KL_MIDNIGHT = new Date("2026-10-28T16:00:00Z");

const fakeResult = (handle: string) => ({ profile: { username: handle } }) as unknown as ScanResult;

/** Same contract as the Postgres store, kept in memory. */
function memoryStore(): ScanStore {
  const quota = new Map<string, number>();
  const cache = new Map<string, ScanResult>();
  const key = (userId: number, day: string) => `${userId}:${day}`;
  return {
    async getCached(handle) {
      return cache.get(handle.toLowerCase()) ?? null;
    },
    async putCached(handle, result) {
      cache.set(handle.toLowerCase(), result);
    },
    async used(userId, day) {
      return quota.get(key(userId, day)) ?? 0;
    },
    async reserve(userId, day, limit) {
      const used = quota.get(key(userId, day)) ?? 0;
      if (used >= limit) return null;
      quota.set(key(userId, day), used + 1);
      return used + 1;
    },
    async release(userId, day) {
      quota.set(key(userId, day), Math.max(0, (quota.get(key(userId, day)) ?? 0) - 1));
    },
  };
}

function setup() {
  const store = memoryStore();
  const calls: string[] = [];
  const ok = async (handle: string) => {
    calls.push(handle);
    return fakeResult(handle);
  };
  return { store, calls, ok };
}

test("KL date and midnight use UTC+8", () => {
  assert.equal(klDate(LATE_NIGHT_KL), "2026-10-28");
  assert.equal(klDate(KL_MIDNIGHT), "2026-10-29");
  assert.equal(nextKlMidnight(LATE_NIGHT_KL).toISOString(), "2026-10-28T16:00:00.000Z");
});

test("first scan is allowed, second is blocked with 429", async () => {
  const { store, ok, calls } = setup();
  const base = { store, userId: 1, isAdmin: false, scan: ok, now: LATE_NIGHT_KL };

  assert.equal((await runScan({ ...base, handle: "alice" })).status, 200);

  const second = await runScan({ ...base, handle: "bob" });
  assert.equal(second.status, 429);
  assert.equal((second.body as { resetsAt?: string }).resetsAt, "2026-10-28T16:00:00.000Z");
  assert.deepEqual(calls, ["alice"]);
  assert.equal((await getQuota(store, 1, false, LATE_NIGHT_KL)).remaining, 0);
});

test("allowed again after the KL midnight rollover", async () => {
  const { store, ok } = setup();
  const base = { store, userId: 1, isAdmin: false, scan: ok };

  assert.equal((await runScan({ ...base, handle: "alice", now: LATE_NIGHT_KL })).status, 200);
  assert.equal((await runScan({ ...base, handle: "bob", now: LATE_NIGHT_KL })).status, 429);

  assert.equal((await getQuota(store, 1, false, KL_MIDNIGHT)).remaining, 1);
  assert.equal((await runScan({ ...base, handle: "carol", now: KL_MIDNIGHT })).status, 200);
});

test("reservation is released when the upstream call fails", async () => {
  const { store, ok } = setup();
  const base = { store, userId: 1, isAdmin: false, now: LATE_NIGHT_KL };

  const unknown = await runScan({
    ...base,
    handle: "ghost",
    scan: async () => {
      throw new ScanError("We could not find @ghost on X.", 404);
    },
  });
  assert.equal(unknown.status, 404);
  assert.equal((await getQuota(store, 1, false, LATE_NIGHT_KL)).remaining, 1);

  const crashed = await runScan({
    ...base,
    handle: "ghost",
    scan: async () => {
      throw new Error("Anthropic timeout");
    },
  });
  assert.equal(crashed.status, 500);
  assert.equal((await getQuota(store, 1, false, LATE_NIGHT_KL)).remaining, 1);

  assert.equal((await runScan({ ...base, handle: "alice", scan: ok })).status, 200);
});

test("cache hits are free and fresh scans are cached", async () => {
  const { store, ok, calls } = setup();
  const now = LATE_NIGHT_KL;

  await runScan({ store, userId: 1, isAdmin: false, handle: "Alice", scan: ok, now });
  const hit = await runScan({ store, userId: 2, isAdmin: false, handle: "alice", scan: ok, now });
  assert.equal(hit.status, 200);
  assert.equal((hit.body as { cached: boolean }).cached, true);
  assert.deepEqual(calls, ["Alice"]);
  assert.equal((await getQuota(store, 2, false, now)).remaining, 1);
});

test("one quota per account, admin bypasses it", async () => {
  const { store, ok } = setup();
  const now = LATE_NIGHT_KL;

  assert.equal((await runScan({ store, userId: 1, isAdmin: false, handle: "a", scan: ok, now })).status, 200);
  assert.equal((await runScan({ store, userId: 2, isAdmin: false, handle: "b", scan: ok, now })).status, 200);
  for (const handle of ["c", "d", "e"]) {
    assert.equal((await runScan({ store, userId: 99, isAdmin: true, handle, scan: ok, now })).status, 200);
  }
  assert.equal((await getQuota(store, 99, true, now)).unlimited, true);
});
