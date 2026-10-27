import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getAccountType, getCreatorProfile } from "@/lib/onboarding";
import { getXAccount } from "@/lib/x-oauth";
import CreatorCard from "@/components/CreatorCard";

export default async function ProfileSavedPage() {
  const s = await requireMember();
  if ((await getAccountType(s.userId)) !== "creator") redirect("/members");
  const [profile, x] = await Promise.all([getCreatorProfile(s.userId), getXAccount(s.userId)]);
  if (!profile) redirect("/members/profile");

  return (
    <>
      <div className="tag">Profile saved</div>
      <h1>Your card is live.</h1>
      <p className="sub">Projects on Hustlers Labs can find you once your profile is reviewed.</p>
      <div className="card-solo">
        <CreatorCard c={profile} size="compact" owner xConnected={x?.username ?? null} />
        <p className="lock-note">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3" y="7" width="10" height="8" fill="none" stroke="#0a0a0a" strokeWidth="1.4" />
            <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="#0a0a0a" strokeWidth="1.4" />
          </svg>
          Your Telegram stays private. Only the Hustlers Labs team can see it.
        </p>
        <div className="btn-pair">
          <a className="btn ghost" href="/members/profile">
            Edit profile
          </a>
          <a className="btn" href="/members">
            Go to home
          </a>
        </div>
      </div>
    </>
  );
}
