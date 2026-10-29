import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getAccountType, getCreatorProfile } from "@/lib/onboarding";

// Every /members page except /members/profile sits in this group. Its pages need an approved member,
// and creators who have not set up their profile yet are sent there first.
export default async function MembersMainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMember();
  if ((await getAccountType(user.userId)) === "creator" && !(await getCreatorProfile(user.userId))) {
    redirect("/members/profile");
  }
  return children;
}
