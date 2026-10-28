// Cleans AI generated text so it reads like a person wrote it.
// Dash characters are written as escapes so this file holds none itself.

const EM = "\u2014";
const EN = "\u2013";

type Swap = [RegExp, string];

// Order matters: longer phrases first.
const SWAPS: Swap[] = [
  [/\bit(?:'|’)s important to note that\s*/gi, ""],
  [/\bit is important to note that\s*/gi, ""],
  [/\bin the ever[- ]evolving (?:world|landscape) of\b/gi, "in"],
  [/\bunlock(?:ing)? the power of\b/gi, "make the most of"],
  [/\b(?:a )?rich tapestry of\b/gi, "a mix of"],
  [/\btapestry\b/gi, "mix"],
  [/\bdelves into\b/gi, "digs into"],
  [/\bdelving into\b/gi, "digging into"],
  [/\bdelved into\b/gi, "dug into"],
  [/\bdelve into\b/gi, "dig into"],
  [/\bgame[- ]changers\b/gi, "big deals"],
  [/\bgame[- ]changer\b/gi, "big deal"],
  [/\bleveraging\b/gi, "using"],
  [/\bleveraged\b/gi, "used"],
  [/\bleverages\b/gi, "uses"],
  [/\bleverage\b/gi, "use"],
  [/\bseamlessly\b/gi, "smoothly"],
  [/\bseamless\b/gi, "smooth"],
];

function matchCase(original: string, replacement: string): string {
  if (!replacement) return replacement;
  const first = original.charAt(0);
  return first === first.toUpperCase() && first !== first.toLowerCase()
    ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
    : replacement;
}

function replaceDashes(text: string): string {
  return (
    text
      // Number ranges like 10 to 20.
      .replace(new RegExp(`(\\d)\\s*[${EM}${EN}]\\s*(\\d)`, "g"), "$1 to $2")
      // A dash before a capital letter starts a new sentence.
      .replace(new RegExp(`\\s*(?:[${EM}${EN}]|--+|\\s-\\s)\\s*(?=[A-Z])`, "g"), ". ")
      // Any other dash becomes a comma.
      .replace(new RegExp(`\\s*(?:[${EM}${EN}]|--+|\\s-\\s)\\s*`, "g"), ", ")
  );
}

function tidy(text: string): string {
  return (
    text
      .replace(/[ \t]+/g, " ")
      .replace(/ +([,.!?;:])/g, "$1")
      .replace(/([,;])(?=[A-Za-z])/g, "$1 ")
      .replace(/([!?])(?=[A-Z])/g, "$1 ")
      .replace(/,\s*([.!?])/g, "$1")
      .replace(/([.!?])\s*,/g, "$1")
      .replace(/,{2,}/g, ",")
      .replace(/(?<!\.)\.{2}(?!\.)/g, ".")
      .replace(/^[\s,;:.]+/, "")
      .replace(/[\s,;:]+$/, "")
      .trim()
  );
}

function capitalise(text: string): string {
  return text
    .replace(/^([^A-Za-z@#]*)([a-z])/, (_, lead: string, ch: string) => lead + ch.toUpperCase())
    .replace(/([.!?]\s+)([a-z])/g, (_, gap: string, ch: string) => gap + ch.toUpperCase());
}

export function humanize(input: string): string {
  let text = input.replace(/\r\n/g, "\n");
  for (const [pattern, replacement] of SWAPS) {
    text = text.replace(pattern, (match) => matchCase(match, replacement));
  }
  text = replaceDashes(text);
  return text
    .split("\n")
    .map((line) => capitalise(tidy(line)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function humanizeDeep<T>(value: T): T {
  if (typeof value === "string") return humanize(value) as T;
  if (Array.isArray(value)) return value.map((item) => humanizeDeep(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, humanizeDeep(v)]),
    ) as T;
  }
  return value;
}
