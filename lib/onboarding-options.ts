// Every option list used in onboarding. Values are stored in the database, so keep them stable.
// Labels are free to change. Used for rendering forms and for server-side validation.

export type Option = { readonly value: string; readonly label: string };

export const ACCOUNT_TYPES = [
  { value: "project", label: "Project" },
  { value: "creator", label: "Creator" },
] as const;

export const PLATFORMS = [
  { value: "x", label: "X" },
  { value: "youtube", label: "YouTube" },
  { value: "telegram", label: "Telegram" },
  { value: "tiktok", label: "TikTok" },
  { value: "other", label: "Other" },
] as const;

export const NICHES = [
  { value: "defi", label: "DeFi" },
  { value: "nfts", label: "NFTs" },
  { value: "rwa", label: "RWA" },
  { value: "trading", label: "Trading" },
  { value: "memecoins", label: "Memecoins" },
  { value: "ai", label: "AI" },
  { value: "gaming", label: "Gaming" },
  { value: "education", label: "Education" },
] as const;

export const CREATOR_AUDIENCE = [
  { value: "under_5k", label: "Under 5k" },
  { value: "5k_25k", label: "5k to 25k" },
  { value: "25k_100k", label: "25k to 100k" },
  { value: "100k_plus", label: "100k+" },
] as const;

export const COLLAB_STATUS = [
  { value: "yes", label: "Yes" },
  { value: "case_by_case", label: "Case by case" },
  { value: "not_now", label: "Not right now" },
] as const;

// Badge text on the creator card, keyed by collab status value.
export const COLLAB_BADGE: Record<string, string> = {
  yes: "Open",
  case_by_case: "Case by case",
  not_now: "Closed",
};

export const PROJECT_CATEGORIES = [
  { value: "defi", label: "DeFi" },
  { value: "nft", label: "NFT" },
  { value: "rwa", label: "RWA" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "gaming", label: "Gaming" },
  { value: "ai", label: "AI" },
  { value: "other", label: "Other" },
] as const;

export const CHAINS = [
  { value: "ethereum", label: "Ethereum" },
  { value: "solana", label: "Solana" },
  { value: "base", label: "Base" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "bnb", label: "BNB" },
  { value: "other", label: "Other" },
] as const;

export const STAGES = [
  { value: "idea", label: "Idea" },
  { value: "testnet", label: "Testnet" },
  { value: "mainnet", label: "Mainnet live" },
  { value: "token_live", label: "Token live" },
] as const;

export const FUNDING = [
  { value: "bootstrapped", label: "Bootstrapped" },
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a_plus", label: "Series A+" },
  { value: "not_disclosed", label: "Not disclosed" },
] as const;

export const TEAM_SIZES = [
  { value: "solo", label: "Solo" },
  { value: "2_5", label: "2 to 5" },
  { value: "6_20", label: "6 to 20" },
  { value: "20_plus", label: "20+" },
] as const;

export const BUDGETS = [
  { value: "under_5k", label: "Under 5k" },
  { value: "5k_15k", label: "5k to 15k" },
  { value: "15k_50k", label: "15k to 50k" },
  { value: "50k_plus", label: "50k+" },
  { value: "not_set", label: "Not set" },
] as const;

export const GOALS = [
  { value: "grow_community", label: "Grow community" },
  { value: "launch_tge", label: "Launch or TGE" },
  { value: "kol_campaign", label: "KOL campaign" },
  { value: "positioning", label: "Positioning and narrative" },
  { value: "partnerships", label: "Partnerships" },
  { value: "real_users", label: "Real users" },
  { value: "fundraising", label: "Fundraising visibility" },
] as const;
export const MAX_GOALS = 2;

export const MARKETING_OWNERS = [
  { value: "no_one", label: "No one" },
  { value: "founder", label: "Founder" },
  { value: "part_time", label: "Part-time" },
  { value: "full_time", label: "Full-time person or team" },
] as const;

export const CHANNELS = [
  { value: "x", label: "X" },
  { value: "discord", label: "Discord" },
  { value: "telegram", label: "Telegram" },
  { value: "website", label: "Website" },
  { value: "blog", label: "Blog" },
  { value: "newsletter", label: "Newsletter" },
  { value: "youtube", label: "YouTube" },
] as const;

// Used for both X followers and community members.
export const AUDIENCE_BANDS = [
  { value: "under_1k", label: "Under 1k" },
  { value: "1k_10k", label: "1k to 10k" },
  { value: "10k_50k", label: "10k to 50k" },
  { value: "50k_plus", label: "50k+" },
] as const;

export const TRIED = [
  { value: "kols", label: "KOLs" },
  { value: "paid_ads", label: "Paid ads" },
  { value: "ambassadors", label: "Ambassadors" },
  { value: "amas_spaces", label: "AMAs or Spaces" },
  { value: "quests", label: "Quests" },
  { value: "agency", label: "Another agency" },
  { value: "nothing", label: "Nothing yet" },
] as const;

export const TOOLS = [
  { value: "kol_match", label: "Find and match KOLs" },
  { value: "campaign_tracking", label: "Campaign tracking" },
  { value: "content_calendar", label: "Content calendar" },
  { value: "narrative_builder", label: "Narrative builder" },
  { value: "community_health", label: "Community health" },
  { value: "competitor_watch", label: "Competitor watch" },
  { value: "done_for_you", label: "Done-for-you support" },
] as const;
export const MAX_TOOLS = 3;

export const PAYMENT_PREFS = [
  { value: "subscription", label: "Monthly subscription" },
  { value: "per_campaign", label: "Per campaign" },
  { value: "not_sure", label: "Not sure yet" },
] as const;

export const MAX_PLATFORM_ROWS = 6;

export function labelOf(list: readonly Option[], value: string | null | undefined): string {
  if (!value) return "-";
  return list.find((o) => o.value === value)?.label ?? value;
}

export function labelsOf(list: readonly Option[], values: readonly string[] | null | undefined): string {
  if (!values || values.length === 0) return "-";
  return values.map((v) => labelOf(list, v)).join(", ");
}
