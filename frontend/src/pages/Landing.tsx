import { LangToggle } from "../components/LangToggle.js";
import { SynthHero } from "../components/SynthHero.js";
import { useT } from "../i18n/index.js";
import { useStore } from "../store.js";

/**
 * Marketing-style entry screen.
 *
 * Layout uses raw CSS classes (.landing-row / .landing-hero / .landing-cta)
 * defined in index.css with @media (min-width:500px) for the row split —
 * bypasses Tailwind JIT/HMR issues that bit us on Win Chrome.
 *  - <500px: single-column stack (hero on top, CTA below)
 *  - ≥500px: left/right split
 *
 * Top-right corner has a 中/EN language toggle. Choice persists to
 * localStorage so subsequent loads land in the same language.
 */
export function Landing() {
  const setPage = useStore((s) => s.setPage);
  const language = useStore((s) => s.language);
  const t = useT();

  return (
    <div className="relative h-full w-full overflow-y-auto">
      {/* Same scene background as Login / BtGate / Chat — light pastel mesh. */}
      <div className="mesh-bg" />
      <div className="mesh-glow" />

      <LangToggle className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-20" />

      <div className="relative z-10 landing-row">
        <div className="landing-hero">
          <SynthHero echoes={0} />
          <p className="mt-4 lg:mt-8 text-ink-900 text-base lg:text-xl xl:text-2xl font-medium leading-relaxed max-w-md lg:max-w-lg">
            {language === "zh"
              ? "让每次渴望都完美"
              : "Let every desire be perfect"}
          </p>
          {language === "zh" && (
            <p className="mt-1.5 lg:mt-2 text-ink-700 text-xs lg:text-base max-w-md tracking-wide">
              Let every desire be perfect
            </p>
          )}
          <p className="mt-4 lg:mt-6 text-ink-500 text-[10px] lg:text-xs font-black uppercase tracking-[0.25em]">
            {t("landing.team.byline")}
          </p>
        </div>

        <div className="landing-cta">
          <div className="flex flex-wrap items-stretch justify-center gap-2 lg:gap-3">
            <div className="feature-badge">
              <div className="title">{t("landing.feature.ai.title")}</div>
              <div className="desc">{t("landing.feature.ai.desc")}</div>
            </div>
            <div className="feature-badge">
              <div className="title">{t("landing.feature.burn.title")}</div>
              <div className="desc">{t("landing.feature.burn.desc")}</div>
            </div>
            <div className="feature-badge">
              <div className="title">{t("landing.feature.safeword.title")}</div>
              <div className="desc">{t("landing.feature.safeword.desc")}</div>
            </div>
          </div>

          <button
            onClick={() => setPage("login")}
            className="btn-start"
            aria-label="Enter"
          >
            <span>{t("landing.start")}</span>
            <span className="arrow" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          <p className="text-xs lg:text-sm text-ink-700 text-center max-w-[320px]">
            {t("landing.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}
