import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getAccountType, getCreatorProfile } from "@/lib/onboarding";
import { getXAccount, xConfigured } from "@/lib/x-oauth";
import { disconnectX } from "./actions";
import ProfileForm from "./ProfileForm";

const X_MESSAGES: Record<string, { text: string; error?: boolean }> = {
  connected: { text: "X account connected." },
  cancelled: { text: "Connecting X was cancelled. Nothing changed." },
  failed: { text: "Could not connect X. Try again.", error: true },
  taken: { text: "That X account is already connected to another Hustlers Labs account.", error: true },
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ x?: string }> }) {
  const s = await requireMember({ allowPending: true });
  if ((await getAccountType(s.userId)) !== "creator") redirect("/members");
  const [profile, x] = await Promise.all([getCreatorProfile(s.userId), getXAccount(s.userId)]);
  const msg = X_MESSAGES[(await searchParams).x ?? ""];

  return (
    <>
      <div className="tag">Creator profile</div>
      <h1>{profile ? "Edit your profile." : "Set up your profile."}</h1>
      <p className="sub">This becomes your creator card. Hustlers Labs uses it to match creators with projects.</p>

      {(xConfigured() || x) && (
        <div className="panel x-connect">
          <div>
            <h2>X account</h2>
            {x ? (
              <p className="note">
                Connected as <span className="mono">@{x.username}</span>
                {x.followers !== null && <> with {x.followers.toLocaleString("en-US")} followers</>}. Your card shows it as
                connected.
              </p>
            ) : (
              <p className="note">
                Connect your X account to prove the handle is yours. This opens X, so save any changes below first.
              </p>
            )}
            {msg && (
              <p className={msg.error ? "error" : "note"} role="status">
                {msg.text}
              </p>
            )}
          </div>
          {x ? (
            <form action={disconnectX}>
              <button type="submit" className="btn ghost small">
                Disconnect
              </button>
            </form>
          ) : (
            <a className="btn" href="/members/profile/x/start">
              Connect X
            </a>
          )}
        </div>
      )}

      <ProfileForm
        xConnected={x?.username ?? null}
        initial={
          profile && {
            creator_no: profile.creator_no,
            created_at: String(profile.created_at),
            display_name: profile.display_name,
            bio: profile.bio,
            platforms: profile.platforms,
            main_handle: profile.main_handle,
            main_platform: profile.main_platform,
            niches: profile.niches,
            audience_band: profile.audience_band,
            region: profile.region,
            languages: profile.languages,
            collab_status: profile.collab_status,
            telegram: profile.telegram,
            verified: profile.verified,
          }
        }
      />
    </>
  );
}
