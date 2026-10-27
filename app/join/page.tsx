import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/ui";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const s = await getSession();
  if (s?.mfaVerified) redirect("/members");
  return (
    <AuthShell>
      <div className="tag">Invite only</div>
      <h1>Create your account.</h1>
      <p className="sub">Tell us who you are, enter the invite key you were given, then choose your own username and password.</p>
      <JoinForm />
      <p className="alt">
        Already a member? <a href="/login">Sign in.</a>
      </p>
    </AuthShell>
  );
}
