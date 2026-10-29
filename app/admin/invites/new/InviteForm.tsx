"use client";

import { useActionState, useState } from "react";
import { createInvite } from "../../actions";
import { SubmitButton } from "@/components/ui";
import { fmtDateTime } from "@/lib/list";

export default function InviteForm() {
  const [state, action] = useActionState(createInvite, undefined);
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <>
      <form action={action} className="row">
        <label>
          Who is it for (optional)
          <input name="label" maxLength={60} placeholder="For example, Maya" autoComplete="off" />
        </label>
        <label style={{ flex: "0 0 160px", minWidth: 0 }}>
          Expires in
          <select name="hours" defaultValue="48">
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
            <option value="168">7 days</option>
          </select>
        </label>
        <label>
          Your password
          <input name="current_password" type="password" autoComplete="current-password" required maxLength={256} />
        </label>
        <label>
          6-digit code from your app
          <input name="code" className="mono" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
        </label>
        <SubmitButton pending="Generating...">Generate key</SubmitButton>
      </form>

      {state?.error && <p className="error" style={{ marginTop: "1rem" }}>{state.error}</p>}

      {state?.key && (
        <div className="reveal">
          <div className="tag" style={{ marginBottom: 0 }}>
            Admin key{state.label ? ` for ${state.label}` : ""}. Shown once only.
          </div>
          <code>{state.key}</code>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.key!);
                  setCopied(state.key!);
                } catch {}
              }}
            >
              {copied === state.key ? "Copied" : "Copy key"}
            </button>
            <span className="note">
              Expires{" "}
              {fmtDateTime(state.expiresAt)}
              . They join at hustlerslabs.com/join/admin and become an admin.
            </span>
          </div>
        </div>
      )}
    </>
  );
}
