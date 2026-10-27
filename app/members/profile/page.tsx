import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getAccountType, getCreatorProfile } from "@/lib/onboarding";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const s = await requireMember();
  if ((await getAccountType(s.userId)) !== "creator") redirect("/members");
  const profile = await getCreatorProfile(s.userId);

  return (
    <>
      <div className="tag">Creator profile</div>
      <h1>{profile ? "Edit your profile." : "Set up your profile."}</h1>
      <p className="sub">This becomes your creator card. Hustlers Labs uses it to match creators with projects.</p>
      <ProfileForm
        initial={
          profile && {
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
