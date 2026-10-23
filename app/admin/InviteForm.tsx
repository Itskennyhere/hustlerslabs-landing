"use client";

import { useActionState, useState } from "react";
import { createInvite } from "./actions";
import { SubmitButton } from "@/components/ui";

export default function InviteForm() {
  const [state, action] = useActionState(createInvite, undefined);
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <>
      <form action={action} className="row">
        <label>
          Who is it for (optional)
          <input name="label" maxLength={60} placeholder="e.g. Maya" autoComplete="off" />
        </label>
        <label style={{ flex: "0 0 160px", minWidth: 0 }}>
          Expires in
          <select name="hours" defaultValue="48">
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
            <option value="168">7 days</option>
          </select>
        </label>
        <SubmitButton pending="Generating...">Generate key</SubmitButton>
      </form>

      {state?.error && <p className="error" style={{ marginTop: "1rem" }}>{state.error}</p>}

      {state?.key && (
        <div className="reveal">
          <div className="tag" style={{ marginBottom: 0 }}>
            Key{state.label ? ` for ${state.label}` : ""}. Shown once only.
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
              {new Date(state.expiresAt!).toLocaleString("en-MY", {
                timeZone: "Asia/Kuala_Lumpur",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              . They sign up at hustlerslabs.com/join.
            </span>
          </div>
        </div>
      )}
    </>
  );
}
