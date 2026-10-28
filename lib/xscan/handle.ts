export const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

// Accepts "name", "@name" or a full x.com or twitter.com profile URL.
export function parseHandle(input: string): string | null {
  let value = input.trim();
  const url = value.match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([^/?#\s]+)/i);
  if (url) value = url[1];
  value = value.replace(/^@/, "");
  return HANDLE_RE.test(value) ? value : null;
}
