import { ScanError } from "./errors";
import type { Tweet } from "./rating";

const SORSA_BASE = "https://api.sorsa.io/v3";
const TIMEOUT_MS = 15_000;

export type SorsaInfo = {
  username: string;
  display_name?: string;
  description?: string;
  profile_image_url?: string;
  followers_count?: number;
  followings_count?: number;
  verified?: boolean;
  protected?: boolean;
};

export type SorsaFollowerStats = {
  followers_count?: number;
  influencers_count?: number;
  projects_count?: number;
  venture_capitals_count?: number;
};

export type SorsaData = {
  info: SorsaInfo;
  score: number | null;
  stats: SorsaFollowerStats | null;
  tweets: Tweet[];
};

class HttpError extends Error {
  constructor(public status: number) {
    super(`Sorsa returned ${status}`);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = process.env.SORSA_API_KEY;
  if (!apiKey) throw new ScanError("The scanner is not configured yet. SORSA_API_KEY is missing.", 500);

  const res = await fetch(`${SORSA_BASE}${path}`, {
    ...init,
    headers: { ApiKey: apiKey, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new HttpError(res.status);
  return (await res.json()) as T;
}

// Some endpoints wrap the payload in a data or user field.
function unwrap<T>(body: unknown, field?: string): T {
  const obj = (body ?? {}) as Record<string, unknown>;
  const inner = (field && obj[field]) || obj.data || obj;
  return inner as T;
}

export async function fetchSorsa(handle: string): Promise<SorsaData> {
  const q = encodeURIComponent(handle);
  const [info, score, stats, tweets] = await Promise.allSettled([
    call<unknown>(`/info?username=${q}`),
    call<unknown>(`/score?username=${q}`),
    call<unknown>(`/followers-stats?username=${q}`),
    call<unknown>("/user-tweets", { method: "POST", body: JSON.stringify({ username: handle }) }),
  ]);

  if (info.status === "rejected") {
    const err = info.reason;
    if (err instanceof ScanError) throw err;
    if (err instanceof HttpError && (err.status === 404 || err.status === 400)) {
      throw new ScanError(`We could not find @${handle} on X.`, 404);
    }
    throw new ScanError("Sorsa is not responding right now. Try again in a few minutes.", 502);
  }

  const user = unwrap<SorsaInfo>(info.value, "user");
  if (!user?.username) throw new ScanError(`We could not find @${handle} on X.`, 404);
  if (user.protected) throw new ScanError(`@${user.username} is a protected account, so we cannot scan it.`, 403);

  // Score and follower stats only exist for accounts Sorsa indexes, mostly crypto. Treat failures as not indexed.
  let scoreValue: number | null = null;
  if (score.status === "fulfilled") {
    const raw = Number(unwrap<{ score?: number }>(score.value).score);
    scoreValue = Number.isFinite(raw) ? raw : null;
  }
  const statsValue = stats.status === "fulfilled" ? unwrap<SorsaFollowerStats>(stats.value) : null;

  if (tweets.status === "rejected" && !(tweets.reason instanceof HttpError && tweets.reason.status === 404)) {
    throw new ScanError("Sorsa could not load recent posts. Try again in a few minutes.", 502);
  }
  const tweetList =
    tweets.status === "fulfilled" ? (unwrap<{ tweets?: Tweet[] }>(tweets.value).tweets ?? []) : [];

  return { info: user, score: scoreValue, stats: statsValue, tweets: tweetList };
}
