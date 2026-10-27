import { COLLAB_BADGE, CREATOR_AUDIENCE, NICHES, PLATFORMS, labelOf } from "@/lib/onboarding-options";
import { PLATFORM_SHORT, avatarUrl, cleanHandle, initials, platformUrl } from "@/lib/platforms";
import Avatar from "./Avatar";

// Everything the card may show. Telegram is deliberately not part of this type.
export type CreatorCardData = {
  display_name: string;
  bio: string;
  platforms: { platform: string; handle: string }[];
  main_handle: string;
  main_platform: string;
  niches: string[];
  audience_band: string;
  region: string;
  collab_status: string;
  verified?: boolean;
};

/** `xConnected`: the X username the creator proved through "Connect X", if any. */
export default function CreatorCard({ c, xConnected = null }: { c: CreatorCardData; xConnected?: string | null }) {
  const name = c.display_name || "Your name";
  const isConnected = (p: { platform: string; handle: string }) =>
    Boolean(xConnected) && p.platform === "x" && cleanHandle(p.handle)?.toLowerCase() === xConnected!.toLowerCase();
  // The connected X account always shows, even if it is not one of the typed-in handles.
  const platforms =
    xConnected && !c.platforms.some(isConnected) ? [{ platform: "x", handle: xConnected }, ...c.platforms] : c.platforms;
  const photo = xConnected ? avatarUrl([], "x", xConnected) : avatarUrl(c.platforms, c.main_platform, c.main_handle);
  return (
    <article className="ccard">
      <header className="ccard-head">
        <Avatar src={photo} fallback={initials(name)} />
        <div className="ccard-id">
          <h3>
            {name}
            {c.verified && (
              <span className="verified" title="Verified by Hustlers Labs">
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="8" fill="#5BDD2F" />
                  <path d="M4.5 8.2 7 10.5l4.5-5" stroke="#0a0a0a" strokeWidth="1.6" fill="none" />
                </svg>
                <span className="sr-only">Verified by Hustlers Labs</span>
              </span>
            )}
          </h3>
          {c.main_handle && cleanHandle(c.main_handle) && <span className="mono note">@{cleanHandle(c.main_handle)}</span>}
          {xConnected && <span className="note">X connected</span>}
        </div>
        {c.collab_status && <span className={`pill ${c.collab_status === "not_now" ? "off" : "on"}`}>{COLLAB_BADGE[c.collab_status] ?? "-"}</span>}
      </header>

      <p className="ccard-bio">{c.bio || "Your one-line bio."}</p>

      {platforms.length > 0 && (
        <ul className="ccard-platforms">
          {platforms.map((p, i) => {
            const url = platformUrl(p.platform, p.handle);
            const connected = isConnected(p);
            const label = `${labelOf(PLATFORMS, p.platform)} ${cleanHandle(p.handle) ? "@" + cleanHandle(p.handle) : ""}${connected ? ", connected" : ""}`.trim();
            return (
              <li key={i}>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label={label}
                    title={label}
                    className={connected ? "connected" : undefined}
                  >
                    {PLATFORM_SHORT[p.platform] ?? "..."}
                  </a>
                ) : (
                  <span title={label}>{PLATFORM_SHORT[p.platform] ?? "..."}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {c.niches.length > 0 && (
        <div className="ccard-tags">
          {c.niches.map((n) => (
            <span key={n} className="tagchip">
              {labelOf(NICHES, n)}
            </span>
          ))}
        </div>
      )}

      <dl className="ccard-meta">
        <div>
          <dt>Audience</dt>
          <dd>{c.audience_band ? labelOf(CREATOR_AUDIENCE, c.audience_band) : "-"}</dd>
        </div>
        <div>
          <dt>Region</dt>
          <dd>{c.region || "-"}</dd>
        </div>
      </dl>
    </article>
  );
}
