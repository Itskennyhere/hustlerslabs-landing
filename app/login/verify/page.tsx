import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/ui";
import VerifyForm from "./VerifyForm";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.mfaVerified) redirect("/members");
  return (
    <AuthShell>
      <div className="tag">Two-step check</div>
      <h1>Enter your code.</h1>
      <p className="sub">Open your authenticator app and enter the 6-digit code for Hustlers Labs.</p>
      <p className="note" style={{ marginBottom: "1rem" }}>
        Lost your phone? Enter one of the recovery codes you saved when you turned on two-step login. Each one works once.
      </p>
      <VerifyForm />
    </AuthShell>
  );
}
