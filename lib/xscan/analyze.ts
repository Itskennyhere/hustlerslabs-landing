import { humanizeDeep } from "../humanize";
import { ScanError } from "./errors";
import type { ScanResult } from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5-5";
const TIMEOUT_MS = 60_000;
export const MAX_POST_LENGTH = 270;

export type AnalyzeInput = {
  handle: string;
  bio: string;
  followers: number;
  sorsaScore: number | null;
  posts: string[];
};

type Analysis = Pick<ScanResult, "niche" | "suggestions">;

const SYSTEM_PROMPT = `You analyse X (Twitter) profiles and write posts for them.

Reply with JSON only, no prose and no code fences, in exactly this shape:
{"niche": string, "secondary": string[], "voice": string, "strengths": string[], "gaps": string[], "suggestions": [{"angle": string, "post": string}]}

Field rules:
niche: the one primary niche, 2 to 4 words.
secondary: up to 2 adjacent niches, 2 to 4 words each.
voice: one sentence on how this person writes.
strengths: exactly 2 short sentences.
gaps: exactly 2 short sentences, each a concrete thing to fix.
suggestions: exactly 3 posts with different angles, for example a take, a story and a how-to. angle is 1 to 3 words. post is under 270 characters, ready to post as is.

Writing rules for every string:
Write like a real person talking to a friend. Plain words, short sentences.
Never use em dashes, en dashes or a hyphen as a dash. Use a full stop or a comma instead.
No hashtags. No emojis. No corporate filler or buzzwords.
Use proper capital letters and end sentences with a full stop.
Suggestions must be original, not rewrites of their posts, and must fit their niche and voice.`;

function buildUserPrompt(input: AnalyzeInput): string {
  const posts = input.posts.length
    ? input.posts.map((p, i) => `${i + 1}. ${p.replace(/\s+/g, " ").trim()}`).join("\n")
    : "No recent original posts.";
  return `Handle: @${input.handle}
Bio: ${input.bio || "Empty."}
Followers: ${input.followers}
Sorsa score: ${input.sorsaScore === null ? "Not indexed." : Math.round(input.sorsaScore)}

Their ${input.posts.length} most recent original posts:
${posts}`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const strList = (value: unknown, max: number) =>
  (Array.isArray(value) ? value : []).map(str).filter(Boolean).slice(0, max);

function endSentence(text: string): string {
  return !text || /[.!?]["')]?$/.test(text) ? text : `${text}.`;
}

// Keeps a post under the limit, cutting at a sentence end when possible.
export function fitPost(text: string): string {
  if (text.length < MAX_POST_LENGTH) return text;
  const head = text.slice(0, MAX_POST_LENGTH - 1);
  const lastStop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (lastStop > 80) return head.slice(0, lastStop + 1);
  const cut = head.slice(0, MAX_POST_LENGTH - 2).replace(/[\s,;:]+\S*$/, "");
  return `${cut}.`;
}

function normalise(raw: unknown): Analysis {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const suggestions = (Array.isArray(obj.suggestions) ? obj.suggestions : [])
    .map((s) => ({ angle: str((s as Record<string, unknown>)?.angle), post: str((s as Record<string, unknown>)?.post) }))
    .filter((s) => s.post)
    .slice(0, 3);

  const analysis: Analysis = humanizeDeep({
    niche: {
      primary: str(obj.niche),
      secondary: strList(obj.secondary, 2),
      voice: str(obj.voice),
      strengths: strList(obj.strengths, 2),
      gaps: strList(obj.gaps, 2),
    },
    suggestions,
  });

  if (!analysis.niche.primary || analysis.suggestions.length === 0) {
    throw new Error("Reply was missing the niche or suggestions");
  }

  analysis.niche.voice = endSentence(analysis.niche.voice);
  analysis.niche.strengths = analysis.niche.strengths.map(endSentence);
  analysis.niche.gaps = analysis.niche.gaps.map(endSentence);
  analysis.suggestions = analysis.suggestions.map((s) => ({ angle: s.angle || "Idea", post: fitPost(endSentence(s.post)) }));
  return analysis;
}

export async function analyzeProfile(input: AnalyzeInput): Promise<Analysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ScanError("The scanner is not configured yet. ANTHROPIC_API_KEY is missing.", 500);

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(input) }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new ScanError("The analysis service did not respond. Try again in a minute.", 502);
  }

  if (!res.ok) {
    console.error("Anthropic error", res.status, await res.text().catch(() => ""));
    throw new ScanError("The analysis service had a problem. Try again in a minute.", 502);
  }

  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (body.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");

  try {
    return normalise(extractJson(text));
  } catch (err) {
    console.error("Could not parse analysis", err, text.slice(0, 500));
    throw new ScanError("The analysis came back in a bad format. Try again.", 502);
  }
}
