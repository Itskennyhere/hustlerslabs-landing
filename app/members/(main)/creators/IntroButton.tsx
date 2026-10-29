"use client";

import { useActionState, useState } from "react";
import { requestIntro } from "./actions";
import { SubmitButton } from "@/components/ui";
import { INTRO_NOTE_MAX } from "@/lib/onboarding-options";

export default function IntroButton({ creatorId, requested }: { creatorId: number; requested: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(requestIntro, undefined);

  if (requested || state?.ok) return <span className="intro-done">Intro requested</span>;
  if (!open) {
    return (
      <button type="button" className="btn small" onClick={() => setOpen(true)}>
        Request intro
      </button>
    );
  }
  return (
    <form action={action} className="intro-form">
      <input type="hidden" name="creator" value={creatorId} />
      <label>
        Note for Hustlers Labs (optional)
        <textarea name="note" maxLength={INTRO_NOTE_MAX} placeholder="What you have in mind, timing, budget." />
      </label>
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div className="row">
        <SubmitButton className="btn small" pending="Sending...">
          Send request
        </SubmitButton>
        <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
