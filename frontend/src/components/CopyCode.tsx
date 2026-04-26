import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface Props {
  code: string;
  className?: string;
  size?: number;
}

/**
 * Small inline button that copies the room code to clipboard. Shows a green
 * check for 1.5s after a successful copy. No-ops silently when clipboard is
 * blocked (insecure context, perms denied) — there's no useful UI to recover
 * with on a one-tap "copy" affordance.
 */
export function CopyCode({ code, className = "", size = 14 }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center rounded-full p-1.5 hover:bg-black/10 active:scale-95 transition ${className}`}
      aria-label="copy room code"
      title={code}
    >
      {copied ? (
        <Check size={size} className="text-green-500" strokeWidth={2.5} />
      ) : (
        <Copy size={size} className="text-black/50" strokeWidth={2} />
      )}
    </button>
  );
}
