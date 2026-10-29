import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import { AuthShell } from "@/components/ui";
import { EMAIL_CODE_MINUTES, maskEmail } from "@/lib/email-step";
import EmailCodeForm from "./EmailCodeForm";

export const dynamic = "force-dynamic";

export default async function EmailCodePage({ searchParams }: { searchParams: Promise<{ send?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.mfaVerified) redirect("/members");
  if (s.stage !== "email") redirect("/login/verify");
  const email = (await q<{ email: string | null }>`SELECT email FROM users WHERE id = ${s.userId}`)[0]?.email;
  const failed = (await searchParams).send === "failed";

  return (
    <AuthShell>
      <div className="tag">Admin check</div>
      <h1>Check your email.</h1>
      <p className="sub">
        We sent a 6-digit code to <span className="mono">{email ? maskEmail(email) : "your email"}</span>. It expires in{" "}
        {EMAIL_CODE_MINUTES} minutes.
      </p>
      {failed && (
        <p className="error" role="alert" style={{ marginBottom: "1rem" }}>
          The email could not be sent. Use Send a new code below.
        </p>
      )}
      <EmailCodeForm />
    </AuthShell>
  );
}
