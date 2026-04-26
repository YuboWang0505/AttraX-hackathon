import { useT } from "../i18n/index.js";
import { useStore } from "../store.js";

interface Props {
  /** Tailwind classes appended to the outer pill (e.g. "top-4 right-4"). */
  className?: string;
  /** Compact mode — smaller pill, used in chat headers where space is tight. */
  compact?: boolean;
}

/**
 * 中/EN language toggle pill, reusable across all pages. Outer container is
 * relatively unstyled by default — pass position via className (typically
 * `absolute top-X right-X` with z-index, or inline within a header row).
 */
export function LangToggle({ className = "", compact = false }: Props) {
  const language = useStore((s) => s.language);
  const setLanguage = useStore((s) => s.setLanguage);
  const t = useT();

  const padX = compact ? "px-2" : "px-3";
  const padY = compact ? "py-0.5" : "py-1";

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-full bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm ${className}`}
    >
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLanguage(l)}
          className={`${padX} ${padY} rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition ${
            language === l
              ? "bg-black text-white"
              : "text-black/40 hover:text-black/70"
          }`}
          aria-label={`Switch to ${l === "zh" ? "Chinese" : "English"}`}
        >
          {l === "zh" ? t("landing.lang.zh") : t("landing.lang.en")}
        </button>
      ))}
    </div>
  );
}
