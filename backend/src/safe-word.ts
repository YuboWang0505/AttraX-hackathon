const PUNCT_CLASS = "!?,.;:、。";
const STRIP_RE = new RegExp(
  `^[\\s${PUNCT_CLASS}]+|[\\s${PUNCT_CLASS}]+$`,
  "g",
);

export function normalize(s: string): string {
  const halfwidth = s.replace(/[！-～]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
  const lowered = halfwidth.toLowerCase();
  return lowered.replace(STRIP_RE, "");
}

export function isSafeWordMatch(text: string, safeWord: string): boolean {
  const a = normalize(text);
  const b = normalize(safeWord);
  if (!b) return false;
  return a === b;
}

export function sanitizeSafeWord(raw: string | undefined | null): string {
  const DEFAULT = "安全词";
  if (!raw) return DEFAULT;
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT;
  return trimmed.slice(0, 16);
}
