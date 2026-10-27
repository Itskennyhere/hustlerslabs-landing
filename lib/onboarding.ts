import "server-only";
import { q } from "./db";
import {
  AUDIENCE_BANDS,
  BUDGETS,
  CHAINS,
  CHANNELS,
  COLLAB_STATUS,
  CREATOR_AUDIENCE,
  FUNDING,
  GOALS,
  MARKETING_OWNERS,
  MAX_GOALS,
  MAX_PLATFORM_ROWS,
  MAX_TOOLS,
  NICHES,
  PAYMENT_PREFS,
  PLATFORMS,
  PROJECT_CATEGORIES,
  STAGES,
  TEAM_SIZES,
  TOOLS,
  TRIED,
} from "./onboarding-options";
import { FieldError, LIMITS, contract, date, email, handle, handleValue, httpsUrl, many, one, text } from "./validate";

export type AccountType = "project" | "creator";

export type Platform = { platform: string; handle: string };

export type CreatorProfile = {
  user_id: number;
  creator_no: number;
  created_at: string;
  display_name: string;
  bio: string;
  platforms: Platform[];
  main_handle: string;
  main_platform: string;
  niches: string[];
  audience_band: string;
  region: string;
  languages: string;
  collab_status: string;
  telegram: string;
  verified: boolean;
  verified_at: string | null;
};

export type ProjectProfile = {
  project_name: string;
  website: string;
  x_handle: string;
  category: string;
  chains: string[];
  stage: string;
  token_contract: string | null;
  funding_stage: string;
  backers: string | null;
  team_size: string;
  budget_band: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_telegram: string;
};

export type Workspace = {
  goals: string[] | null;
  key_date: string | null;
  key_date_note: string | null;
  blocker: string | null;
  success_90d: string | null;
  goals_done_at: string | null;
  marketing_owner: string | null;
  channels: string[] | null;
  x_followers_band: string | null;
  community_band: string | null;
  tried: string[] | null;
  marketing_done_at: string | null;
  wanted_tools: string[] | null;
  payment_pref: string | null;
  buying_done_at: string | null;
};

// ---------- Parsing (throws FieldError) ----------

export function parseAccountType(form: FormData): AccountType {
  const v = String(form.get("account_type") ?? "");
  if (v !== "project" && v !== "creator") throw new FieldError("account_type", "Choose what best describes you.");
  return v;
}

export function parseProjectProfile(form: FormData): ProjectProfile {
  const stage = one(form, "stage", "Stage", STAGES)!;
  return {
    project_name: text(form, "project_name", "Project name", LIMITS.name)!,
    website: httpsUrl(form, "website", "Website"),
    x_handle: handle(form, "x_handle", "X handle"),
    category: one(form, "category", "Category", PROJECT_CATEGORIES)!,
    chains: many(form, "chains", "Chains", CHAINS, { min: 1 }),
    stage,
    // Only kept when the token is live; ignored otherwise.
    token_contract: stage === "token_live" ? contract(form, "token_contract") : null,
    funding_stage: one(form, "funding_stage", "Funding stage", FUNDING)!,
    backers: text(form, "backers", "Backers or partners", LIMITS.text, false),
    team_size: one(form, "team_size", "Team size", TEAM_SIZES)!,
    budget_band: one(form, "budget_band", "Monthly marketing budget", BUDGETS)!,
    contact_name: text(form, "contact_name", "Decision maker name", LIMITS.name)!,
    contact_role: text(form, "contact_role", "Decision maker role", LIMITS.name)!,
    contact_email: email(form, "contact_email", "Decision maker email"),
    contact_telegram: handle(form, "contact_telegram", "Decision maker Telegram"),
  };
}

export type CreatorInput = Omit<CreatorProfile, "user_id" | "creator_no" | "created_at" | "verified" | "verified_at">;

export function parseCreatorProfile(form: FormData): CreatorInput {
  // Rows are platform_N / handle_N; `main` holds the N of the main row. Empty rows are skipped.
  const platforms: Platform[] = [];
  const mainRow = Number(form.get("main"));
  let main: Platform | undefined;
  for (let i = 0; i < MAX_PLATFORM_ROWS; i++) {
    const p = String(form.get(`platform_${i}`) ?? "").trim();
    const h = String(form.get(`handle_${i}`) ?? "").trim();
    if (!p && !h) continue;
    if (!PLATFORMS.some((o) => o.value === p)) throw new FieldError(`platform_${i}`, "Pick a valid platform.");
    const row = { platform: p, handle: handleValue(h, `handle_${i}`, "Handle") };
    platforms.push(row);
    if (i === mainRow) main = row;
  }
  if (platforms.length === 0) throw new FieldError("platforms", "Add at least one platform and handle.");
  if (!main) throw new FieldError("platforms", "Mark one platform as your main one.");

  return {
    display_name: text(form, "display_name", "Display name", 40)!,
    bio: text(form, "bio", "Bio", LIMITS.bio)!,
    platforms,
    main_handle: main.handle,
    main_platform: main.platform,
    niches: many(form, "niches", "Niche", NICHES, { min: 1 }),
    audience_band: one(form, "audience_band", "Audience size", CREATOR_AUDIENCE)!,
    region: text(form, "region", "Audience region", LIMITS.name)!,
    languages: text(form, "languages", "Languages", LIMITS.name)!,
    collab_status: one(form, "collab_status", "Paid collaborations", COLLAB_STATUS)!,
    telegram: handle(form, "telegram", "Telegram handle"),
  };
}

export function parseGoals(form: FormData) {
  return {
    goals: many(form, "goals", "Goals", GOALS, { max: MAX_GOALS }),
    key_date: date(form, "key_date", "Key date"),
    key_date_note: text(form, "key_date_note", "Key date note", LIMITS.name, false),
    blocker: text(form, "blocker", "Biggest blocker", LIMITS.text, false),
    success_90d: text(form, "success_90d", "Success in 90 days", LIMITS.text)!,
  };
}

export function parseMarketing(form: FormData) {
  return {
    marketing_owner: one(form, "marketing_owner", "Who handles marketing", MARKETING_OWNERS)!,
    channels: many(form, "channels", "Channels", CHANNELS, { min: 1 }),
    x_followers_band: one(form, "x_followers_band", "X followers", AUDIENCE_BANDS, false),
    community_band: one(form, "community_band", "Community size", AUDIENCE_BANDS, false),
    tried: many(form, "tried", "What you have tried", TRIED),
  };
}

export function parseBuying(form: FormData) {
  return {
    wanted_tools: many(form, "wanted_tools", "Tools", TOOLS, { max: MAX_TOOLS }),
    payment_pref: one(form, "payment_pref", "Payment preference", PAYMENT_PREFS, false),
  };
}

// ---------- Reads ----------

export async function getAccountType(userId: number): Promise<AccountType | null> {
  const rows = await q<{ account_type: AccountType | null }>`SELECT account_type FROM users WHERE id = ${userId}`;
  return rows[0]?.account_type ?? null;
}

export async function getCreatorProfile(userId: number): Promise<CreatorProfile | null> {
  const rows = await q<CreatorProfile>`SELECT * FROM creator_profiles WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

export async function getProjectProfile(userId: number): Promise<ProjectProfile | null> {
  const rows = await q<ProjectProfile>`
    SELECT project_name, website, x_handle, category, chains, stage, token_contract, funding_stage, backers,
           team_size, budget_band, contact_name, contact_role, contact_email, contact_telegram
    FROM project_profiles WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

export async function getWorkspace(userId: number): Promise<Workspace | null> {
  const rows = await q<Workspace>`
    SELECT goals, key_date::text AS key_date, key_date_note, blocker, success_90d, goals_done_at,
           marketing_owner, channels, x_followers_band, community_band, tried, marketing_done_at,
           wanted_tools, payment_pref, buying_done_at
    FROM project_workspace WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

export const WORKSPACE_SECTIONS = [
  { slug: "goals", title: "Goals", doneKey: "goals_done_at" },
  { slug: "marketing", title: "Current marketing", doneKey: "marketing_done_at" },
  { slug: "buying", title: "Tools and payment", doneKey: "buying_done_at" },
] as const;

export function workspaceProgress(w: Workspace | null): number {
  if (!w) return 0;
  return WORKSPACE_SECTIONS.filter((s) => w[s.doneKey]).length;
}

/** True once a project has finished all workspace sections. Tools and the creator roster wait for this. */
export async function workspaceComplete(userId: number): Promise<boolean> {
  return workspaceProgress(await getWorkspace(userId)) === WORKSPACE_SECTIONS.length;
}

/** New intro requests, for the count beside the Admin link. */
export async function newIntroCount(): Promise<number> {
  const r = await q<{ n: number }>`SELECT count(*)::int AS n FROM intro_requests WHERE status = 'new'`;
  return r[0]?.n ?? 0;
}
