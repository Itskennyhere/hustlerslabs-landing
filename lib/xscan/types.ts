export type Grade = "S" | "A" | "B" | "C" | "D" | "E";

export type RatingPart = {
  key: "influence" | "engagement" | "audience" | "consistency";
  label: string;
  score: number;
  max: number;
  detail: string;
};

export type ScanResult = {
  profile: {
    username: string;
    name: string;
    avatar: string | null;
    followers: number;
    following: number;
    verified: boolean;
    bio: string;
  };
  sorsa: {
    indexed: boolean;
    score: number | null;
    influencers: number | null;
    projects: number | null;
    vcEmployees: number | null;
  };
  rating: {
    total: number;
    grade: Grade;
    parts: RatingPart[];
  };
  niche: {
    primary: string;
    secondary: string[];
    voice: string;
    strengths: string[];
    gaps: string[];
  };
  suggestions: { angle: string; post: string }[];
  scannedAt: string;
};

export type QuotaStatus = {
  unlimited: boolean;
  limit: number;
  remaining: number;
  resetsAt: string;
};

export type ScanResponse = {
  result: ScanResult;
  cached: boolean;
  quota: QuotaStatus;
};
