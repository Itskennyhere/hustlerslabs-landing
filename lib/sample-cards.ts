// Example cards for Admin > Members. Clearly fake, never stored, never shown outside the example frame.
// Every field is filled, with long names and the most tags, so overflow problems show up.
import type { CreatorCardData } from "@/components/CreatorCard";
import type { ProjectCardData, ProjectContact } from "@/components/ProjectCard";

/** What an investor card shows. Investor sign-up comes later; it only has to fill this type. */
export type InvestorCardData = {
  member_no: number;
  display_name: string;
  role: string;
  fund_name: string;
  x_handle: string | null;
  bio: string | null;
  check_size: string;
  investor_type: string;
  region: string;
  stages: string[];
  sectors: string[];
  verified: boolean;
  created_at: string;
};

export const SAMPLE_PROJECT: ProjectCardData & ProjectContact = {
  user_id: 42,
  project_name: "Sample Project Protocol for Very Long Names",
  x_handle: "",
  category: "infrastructure",
  chains: ["ethereum", "solana", "base", "arbitrum", "bnb", "other"],
  stage: "token_live",
  budget_band: "15k_50k",
  team_size: "6_20",
  progress: 2,
  created_at: "2026-10-01T00:00:00Z",
  contact_name: "Alexandra Example-Founderson",
  contact_role: "Co-founder and Head of Growth",
};

export const SAMPLE_CREATOR: CreatorCardData = {
  creator_no: 42,
  created_at: "2026-10-01T00:00:00Z",
  display_name: "Sample Creator With a Long Name",
  bio: "Example bio. Breaking down DeFi, onchain trading and new launches for normal people, with weekly threads and long YouTube deep dives. 160 max.",
  platforms: [
    { platform: "x", handle: "sample_creator_x" },
    { platform: "youtube", handle: "samplecreatorchannel" },
    { platform: "telegram", handle: "sample_creator_tg" },
    { platform: "tiktok", handle: "samplecreator" },
    { platform: "other", handle: "samplecreator.example" },
    { platform: "x", handle: "sample_creator_alt" },
  ],
  main_handle: "samplecreatorchannel",
  main_platform: "youtube",
  niches: ["defi", "nfts", "rwa", "trading", "memecoins", "ai", "gaming", "education"],
  audience_band: "25k_100k",
  region: "Southeast Asia and Australia",
  languages: "English, Bahasa, Mandarin",
  collab_status: "case_by_case",
  verified: true,
};

export const SAMPLE_INVESTOR: InvestorCardData = {
  member_no: 42,
  display_name: "Sample Investor With a Long Name",
  role: "General Partner",
  fund_name: "Example Fund Capital Partners",
  x_handle: null,
  bio: "Example bio. Backs early teams in DeFi infrastructure and onchain consumer apps. Usually leads or co-leads pre-seed and seed rounds.",
  check_size: "$50k to $250k",
  investor_type: "Venture fund",
  region: "Asia and Europe",
  stages: ["Pre-seed", "Seed", "Series A"],
  sectors: ["DeFi", "Infrastructure", "AI", "Gaming", "RWA", "Consumer"],
  verified: true,
  created_at: "2026-10-01T00:00:00Z",
};
