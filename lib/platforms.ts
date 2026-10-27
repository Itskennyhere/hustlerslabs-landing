// Safe to import from client and server components.

const HANDLE_RE = /^[A-Za-z0-9_.]{1,40}$/;

const URLS: Record<string, (h: string) => string> = {
  x: (h) => `https://x.com/${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  telegram: (h) => `https://t.me/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
};

export const PLATFORM_SHORT: Record<string, string> = { x: "X", youtube: "YT", telegram: "TG", tiktok: "TT", other: "+" };

export function cleanHandle(raw: string): string | null {
  const h = raw.trim().replace(/^@/, "");
  return HANDLE_RE.test(h) ? h : null;
}

/** Profile link for a platform handle, or null if the handle is invalid or the platform has no known URL. */
export function platformUrl(platform: string, raw: string): string | null {
  const h = cleanHandle(raw);
  const build = URLS[platform];
  return h && build ? build(h) : null;
}

export function avatarUrl(platforms: { platform: string; handle: string }[], mainPlatform: string, mainHandle: string): string | null {
  const x = mainPlatform === "x" ? mainHandle : platforms.find((p) => p.platform === "x")?.handle;
  const h = x ? cleanHandle(x) : null;
  return h ? `https://unavatar.io/x/${h}` : null;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}
