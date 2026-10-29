"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { sendFeedback } from "@/app/members/feedback/actions";
import { SubmitButton } from "./ui";
import { FEEDBACK_KINDS, FEEDBACK_MAX } from "@/lib/feedback-options";

/** The Feedback button at the bottom right of member pages, and the small form it opens. */
export default function FeedbackButton() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // A new key gives a fresh form (and clears the thank-you) each time it opens.
  const [round, setRound] = useState(0);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="feedback">
      {open && (
        <div className="feedback-panel" role="dialog" aria-labelledby="feedback-title">
          <FeedbackForm key={round} page={path} onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        ref={toggle}
        type="button"
        className="feedback-toggle"
        aria-expanded={open}
        onClick={() => {
          if (!open) setRound((r) => r + 1);
          setOpen(!open);
        }}
      >
        {open ? "Close" : "Feedback"}
      </button>
    </div>
  );
}

function FeedbackForm({ page, onClose }: { page: string; onClose: () => void }) {
  const [state, action] = useActionState(sendFeedback, undefined);

  if (state?.ok) {
    return (
      <div className="feedback-thanks" role="status">
        <h2 id="feedback-title">Thank you.</h2>
        <p>The team reads every note. It helps us decide what to build next.</p>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }
  return (
    <form action={action} className="feedback-form">
      <h2 id="feedback-title">Tell us what you think</h2>
      <p className="note">What would you like to see here, or what could we do better?</p>
      <input type="hidden" name="page" value={page} />
      <fieldset className="feedback-kinds">
        <legend className="sr-only">What it&apos;s about</legend>
        {FEEDBACK_KINDS.map((k, i) => (
          <label key={k.value}>
            <input type="radio" name="kind" value={k.value} defaultChecked={i === 0} />
            {k.label}
          </label>
        ))}
      </fieldset>
      <label>
        <span className="sr-only">Your feedback</span>
        <textarea name="message" required maxLength={FEEDBACK_MAX} placeholder="Write as much or as little as you like." autoFocus />
      </label>
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton className="btn small" pending="Sending...">
        Send feedback
      </SubmitButton>
    </form>
  );
}
