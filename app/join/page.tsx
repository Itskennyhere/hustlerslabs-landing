import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/ui";
import JoinForm from "./JoinForm";
import { readInviteTicket } from "@/lib/invite-code";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const s = await getSession();
  if (s?.mfaVerified) redirect("/members");
  const preferred = (await readInviteTicket())?.kind === "member";
  return (
    <AuthShell>
      <div className="tag">Join</div>
      <h1>Create your account.</h1>
      <p className="sub">Tell us who you are and choose your login. A member of the Hustlers Labs team reviews every new account before it opens.</p>
      {preferred && (
        <p className="banner-inline" role="status">
          Invite accepted. Your account skips the team review: confirm your email and you are in.
        </p>
      )}
      <JoinForm />
      <p className="alt">
        Already a member? <a href="/login">Sign in.</a>
      </p>
    </AuthShell>
  );
}
