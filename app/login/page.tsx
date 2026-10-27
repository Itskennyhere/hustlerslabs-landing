import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/ui";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const s = await getSession();
  if (s?.mfaVerified) redirect("/members");
  return (
    <AuthShell>
      <div className="tag">Members only</div>
      <h1>Sign in.</h1>
      <p className="sub">Access for invited members of Hustlers Labs.</p>
      {(await searchParams).reset === "1" && (
        <p className="note" role="status" style={{ marginBottom: "1rem" }}>
          Password updated. Sign in with your new password.
        </p>
      )}
      <LoginForm />
      <p className="alt">
        <a href="/login/forgot">Forgot password?</a>
      </p>
      <p className="alt">
        Got an invite key? <a href="/join">Create your account.</a>
      </p>
    </AuthShell>
  );
}
