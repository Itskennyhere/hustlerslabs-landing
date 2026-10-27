import { AuthShell } from "@/components/ui";
import { ForgotForm } from "../EmailForms";

export const dynamic = "force-dynamic";

export default function ForgotPage() {
  return (
    <AuthShell>
      <div className="tag">Password reset</div>
      <h1>Forgot your password?</h1>
      <p className="sub">Enter your username or the email you confirmed in Account. We will email you a link to choose a new password.</p>
      <ForgotForm />
      <p className="alt">
        No confirmed email on your account? Ask Hustlers Labs to help. <a href="/login">Back to sign in.</a>
      </p>
    </AuthShell>
  );
}
