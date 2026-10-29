import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getAccountType, getProjectProfile } from "@/lib/onboarding";
import { BackLink } from "@/components/list";
import { ProjectDetailsForm } from "../Forms";

export default async function ProjectDetailsPage() {
  const s = await requireMember();
  if ((await getAccountType(s.userId)) !== "project") notFound();
  const project = await getProjectProfile(s.userId);
  if (!project) notFound();
  return (
    <>
      <BackLink href="/members/account">Back to Account</BackLink>
      <div className="tag">Account</div>
      <h1>Project details.</h1>
      <p className="sub">The answers you gave at sign-up. Keep them up to date.</p>
      <ProjectDetailsForm values={project} />
    </>
  );
}
