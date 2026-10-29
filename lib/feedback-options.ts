// Feedback choices and limits, shared by the button (client) and the server.

export const FEEDBACK_KINDS = [
  { value: "idea", label: "Something I'd like to see" },
  { value: "improve", label: "Something to improve" },
  { value: "problem", label: "Something isn't working" },
] as const;
export const FEEDBACK_STATUS = [
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "done", label: "Done" },
] as const;
export const FEEDBACK_MAX = 1000;
export const FEEDBACK_PER_DAY = 10;

export function feedbackKindLabel(v: string): string {
  return FEEDBACK_KINDS.find((k) => k.value === v)?.label ?? v;
}
