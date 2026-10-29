import { COLLAB_CARD_TEXT, CREATOR_AUDIENCE, NICHES, PLATFORMS, labelOf } from "@/lib/onboarding-options";
import { PLATFORM_SHORT, avatarUrl, cleanHandle, initials, platformUrl } from "@/lib/platforms";
import Avatar from "./Avatar";
import { CardStrip, StatusChip, VerifiedTick, cardNo, joined, since, type MemberStatus } from "./card-parts";

// Everything the card may show. Telegram is deliberately not part of this type.
export type CreatorCardData = {
  creator_no?: number | null;
  created_at?: string | Date | null;
  display_name: string;
  bio: string;
  platforms: { platform: string; handle: string }[];
  main_handle: string;
  main_platform: string;
  niches: string[];
  audience_band: string;
  region: string;
  languages: string;
  collab_status: string;
  verified?: boolean;
};

export const creatorNo = cardNo;

/**
 * The creator ID card. Works in server pages and in the profile form's live preview.
 * - `size`: "full" (profile, home, admin detail) or "compact" (roster grids).
 * - `owner`: the viewer is this creator, so an unverified card shows "Pending review".
 * - `xConnected`: the X username proved through Connect X, if any.
 * - `action`: replaces the "Since" date in the footer (the roster's Request intro button).
 * - `status`: admin views only. Adds the status chip and shows the joined date.
 */
export default function CreatorCard({
  c,
  size = "full",
  owner = false,
  xConnected = null,
  action,
  status,
}: {
  c: CreatorCardData;
  size?: "full" | "compact";
  owner?: boolean;
  xConnected?: string | null;
  action?: React.ReactNode;
  status?: MemberStatus;
}) {
  const full = size === "full";
  const name = c.display_name || "Your name";
  const isConnected = (p: { platform: string; handle: string }) =>
    Boolean(xConnected) && p.platform === "x" && cleanHandle(p.handle)?.toLowerCase() === xConnected!.toLowerCase();
  // The connected X account always shows, even if it is not one of the typed-in handles.
  const platforms =
    xConnected && !c.platforms.some(isConnected) ? [{ platform: "x", handle: xConnected }, ...c.platforms] : c.platforms;
  const isMain = (p: { platform: string; handle: string }) => p.platform === c.main_platform && p.handle === c.main_handle;
  const photo = xConnected ? avatarUrl([], "x", xConnected) : avatarUrl(c.platforms, c.main_platform, c.main_handle);
  const handle = cleanHandle(c.main_handle);
  const collab = c.collab_status || "";

  return (
    <article className={`ccard ${size}`}>
      {full && <CardStrip type="creator" no={creatorNo(c.creator_no)} />}

      <div className="ccard-body">
        <div className="ccard-identity">
          <Avatar src={photo} fallback={initials(name)} size={full ? 72 : 50} />
          <div className="ccard-id">
            <h3>
              <span className="ccard-name">{name}</span>
              {c.verified ? (
                <VerifiedTick />
              ) : (
                owner && <span className="pending-chip">Pending review</span>
              )}
            </h3>
            {handle && <span className="ccard-handle">@{handle}</span>}
            {xConnected && <span className="ccard-handle">X connected</span>}
            {!full && <span className="ccard-handle">{creatorNo(c.creator_no)}</span>}
          </div>
        </div>

        <p className="ccard-bio">{c.bio || "Your bio."}</p>

        <dl className="ccard-stats">
          <div>
            <dt>Audience</dt>
            <dd>{c.audience_band ? labelOf(CREATOR_AUDIENCE, c.audience_band) : "-"}</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>{c.region || "-"}</dd>
          </div>
          <div>
            <dt>Languages</dt>
            <dd>{c.languages || "-"}</dd>
          </div>
        </dl>

        {c.niches.length > 0 && (
          <div className="ccard-tags">
            {c.niches.map((n) => (
              <span key={n} className="tagchip">
                {labelOf(NICHES, n)}
              </span>
            ))}
          </div>
        )}

        {platforms.length > 0 && (
          <ul className={full ? "ccard-platforms rows" : "ccard-platforms boxes"}>
            {platforms.map((p, i) => {
              const url = platformUrl(p.platform, p.handle);
              const h = cleanHandle(p.handle);
              const connected = isConnected(p);
              const main = isMain(p);
              const short = PLATFORM_SHORT[p.platform] ?? "+";
              const label = `${labelOf(PLATFORMS, p.platform)}${h ? " @" + h : ""}${main ? ", main" : ""}${connected ? ", connected" : ""}`;
              const box = <span className={`pbox${main ? " main" : ""}`}>{short}</span>;
              if (!full) {
                return (
                  <li key={i}>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label={label} title={label} className={connected ? "connected" : undefined}>
                        {box}
                      </a>
                    ) : (
                      <span title={label}>{box}</span>
                    )}
                  </li>
                );
              }
              return (
                <li key={i}>
                  {box}
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label={label} className={connected ? "connected" : undefined}>
                      @{h}
                    </a>
                  ) : (
                    <span>{h ? `@${h}` : p.handle}</span>
                  )}
                  {main && <span className="pmain">Main</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="ccard-foot">
        {collab ? (
          <span className={`collab ${collab}`}>
            {collab === "yes" && <span className="dot" aria-hidden="true" />}
            {COLLAB_CARD_TEXT[collab] ?? "-"}
          </span>
        ) : (
          <span />
        )}
        {status && <StatusChip status={status} />}
        {action ?? <span className="ccard-since">{status ? joined(c.created_at) : since(c.created_at)}</span>}
      </footer>
    </article>
  );
}
