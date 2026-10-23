import { notFound } from "next/navigation";
import { AuthShell } from "@/components/ui";
import { adminExists } from "@/lib/setup";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

// One-time page. Disappears (404) once an admin exists or if no setup token is configured.
export default async function SetupPage() {
  if (!process.env.ADMIN_SETUP_TOKEN || (await adminExists())) notFound();
  return (
    <AuthShell>
      <div className="tag">First-time setup</div>
      <h1>Create the admin account.</h1>
      <p className="sub">This page works once. After this, it is gone.</p>
      <SetupForm />
    </AuthShell>
  );
}
