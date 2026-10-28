import type { Grade, RatingPart } from "./types";

// Tuning constants. Change these to reweight the 0 to 100 rating.
export const INFLUENCE_MAX = 40;
export const INFLUENCE_SCORE_TARGET = 3000;

export const ENGAGEMENT_MAX = 25;
export const ENGAGEMENT_RATE_TARGET = 0.04;
export const ENGAGEMENT_WEIGHTS = { likes: 1, retweets: 2, replies: 2, quotes: 2, bookmarks: 1 };

export const AUDIENCE_MAX = 20;
export const AUDIENCE_CATEGORY_TARGET = 2000;

export const CONSISTENCY_MAX = 15;
export const POSTS_PER_WEEK_TARGET = 14;
export const ORIGINAL_SHARE_TARGET = 0.6;
export const POSTS_PER_WEEK_WEIGHT = 0.6;
export const ORIGINAL_SHARE_WEIGHT = 0.4;

export const GRADE_THRESHOLDS: [Grade, number][] = [
  ["S", 90],
  ["A", 80],
  ["B", 65],
  ["C", 50],
  ["D", 35],
];

export type Tweet = {
  full_text?: string;
  created_at?: string;
  likes_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  view_count?: number;
  bookmark_count?: number;
  is_reply?: boolean;
  retweeted_status?: unknown;
};

export type RatingInput = {
  followers: number;
  sorsaScore: number | null;
  categoryCount: number | null;
  tweets: Tweet[];
  now?: Date;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const clamp = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
const round1 = (value: number) => Math.round(value * 10) / 10;

export const isRetweet = (t: Tweet) => Boolean(t.retweeted_status);

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function gradeFor(total: number): Grade {
  return GRADE_THRESHOLDS.find(([, min]) => total >= min)?.[0] ?? "E";
}

export function engagementRate(tweets: Tweet[], followers: number): number {
  const w = ENGAGEMENT_WEIGHTS;
  const rates = tweets
    .filter((t) => !isRetweet(t))
    .map((t) => {
      const views = t.view_count ?? 0;
      const base = views > 0 ? views : followers;
      if (base <= 0) return null;
      const weighted =
        (t.likes_count ?? 0) * w.likes +
        (t.retweet_count ?? 0) * w.retweets +
        (t.reply_count ?? 0) * w.replies +
        (t.quote_count ?? 0) * w.quotes +
        (t.bookmark_count ?? 0) * w.bookmarks;
      return weighted / base;
    })
    .filter((rate): rate is number => rate !== null);
  return median(rates);
}

export function postingStats(tweets: Tweet[], now: Date) {
  const own = tweets.filter((t) => !isRetweet(t));
  const times = own.map((t) => Date.parse(t.created_at ?? "")).filter(Number.isFinite);
  if (!own.length || !times.length) return { postsPerWeek: 0, originalShare: 0 };

  // Window runs from the oldest post on the page to now, at least one day.
  const spanMs = Math.max(now.getTime() - Math.min(...times), DAY_MS);
  const postsPerWeek = times.length / (spanMs / WEEK_MS);
  const originalShare = own.filter((t) => !t.is_reply).length / own.length;
  return { postsPerWeek, originalShare };
}

export function rate(input: RatingInput): { total: number; grade: Grade; parts: RatingPart[] } {
  const now = input.now ?? new Date();

  const influence =
    input.sorsaScore === null
      ? 0
      : clamp(Math.log10(input.sorsaScore + 1) / Math.log10(INFLUENCE_SCORE_TARGET)) * INFLUENCE_MAX;

  const engRate = engagementRate(input.tweets, input.followers);
  const engagement = clamp(engRate / ENGAGEMENT_RATE_TARGET) * ENGAGEMENT_MAX;

  const audience =
    input.categoryCount === null
      ? 0
      : clamp(Math.log10(input.categoryCount + 1) / Math.log10(AUDIENCE_CATEGORY_TARGET)) * AUDIENCE_MAX;

  const { postsPerWeek, originalShare } = postingStats(input.tweets, now);
  const consistency =
    (clamp(postsPerWeek / POSTS_PER_WEEK_TARGET) * POSTS_PER_WEEK_WEIGHT +
      clamp(originalShare / ORIGINAL_SHARE_TARGET) * ORIGINAL_SHARE_WEIGHT) *
    CONSISTENCY_MAX;

  const parts: RatingPart[] = [
    {
      key: "influence",
      label: "Influence",
      score: round1(influence),
      max: INFLUENCE_MAX,
      detail: input.sorsaScore === null ? "Not indexed by Sorsa." : `Sorsa score ${Math.round(input.sorsaScore)}.`,
    },
    {
      key: "engagement",
      label: "Engagement",
      score: round1(engagement),
      max: ENGAGEMENT_MAX,
      detail: `Median weighted rate ${(engRate * 100).toFixed(2)}% per post.`,
    },
    {
      key: "audience",
      label: "Audience quality",
      score: round1(audience),
      max: AUDIENCE_MAX,
      detail:
        input.categoryCount === null
          ? "Not indexed by Sorsa."
          : `${input.categoryCount} notable followers.`,
    },
    {
      key: "consistency",
      label: "Consistency",
      score: round1(consistency),
      max: CONSISTENCY_MAX,
      detail: `${postsPerWeek.toFixed(1)} posts a week, ${Math.round(originalShare * 100)}% original.`,
    },
  ];

  const total = Math.round(influence + engagement + audience + consistency);
  return { total, grade: gradeFor(total), parts };
}
