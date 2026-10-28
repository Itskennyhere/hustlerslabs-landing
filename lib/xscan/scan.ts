import { analyzeProfile } from "./analyze";
import { isRetweet, rate } from "./rating";
import { fetchSorsa } from "./sorsa";
import type { ScanResult } from "./types";

const ANALYSIS_POST_COUNT = 15;

const bigAvatar = (url?: string) => (url ? url.replace("_normal.", "_400x400.") : null);

// Runs the full scan for one handle: Sorsa data, rating, then niche and suggestions.
export async function scanProfile(handle: string): Promise<ScanResult> {
  const { info, score, stats, tweets } = await fetchSorsa(handle);
  const followers = info.followers_count ?? stats?.followers_count ?? 0;

  const categoryCount = stats
    ? (stats.influencers_count ?? 0) + (stats.projects_count ?? 0) + (stats.venture_capitals_count ?? 0)
    : null;

  const rating = rate({ followers, sorsaScore: score, categoryCount, tweets });

  const posts = tweets
    .filter((t) => !isRetweet(t) && !t.is_reply && t.full_text)
    .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))
    .slice(0, ANALYSIS_POST_COUNT)
    .map((t) => t.full_text as string);

  const analysis = await analyzeProfile({
    handle: info.username,
    bio: info.description ?? "",
    followers,
    sorsaScore: score,
    posts,
  });

  return {
    profile: {
      username: info.username,
      name: info.display_name || info.username,
      avatar: bigAvatar(info.profile_image_url),
      followers,
      following: info.followings_count ?? 0,
      verified: Boolean(info.verified),
      bio: info.description ?? "",
    },
    sorsa: {
      indexed: score !== null,
      score,
      influencers: stats?.influencers_count ?? null,
      projects: stats?.projects_count ?? null,
      vcEmployees: stats?.venture_capitals_count ?? null,
    },
    rating,
    ...analysis,
    scannedAt: new Date().toISOString(),
  };
}
