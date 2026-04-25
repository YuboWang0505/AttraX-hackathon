import { SynthHero } from "../components/SynthHero.js";
import { useStore } from "../store.js";

/**
 * Marketing-style entry screen.
 *
 * Layout uses raw CSS classes (.landing-row / .landing-hero / .landing-cta)
 * defined in index.css with @media (min-width:500px) for the row split —
 * bypasses Tailwind JIT/HMR issues that bit us on Win Chrome.
 *  - <500px: single-column stack (hero on top, CTA below)
 *  - ≥500px: left/right split
 */
export function Landing() {
  const setPage = useStore((s) => s.setPage);

  return (
    <div className="relative h-full w-full overflow-y-auto">
      {/* Same scene background as Login / BtGate / Chat — light pastel mesh. */}
      <div className="mesh-bg" />
      <div className="mesh-glow" />

      <div className="relative z-10 landing-row">
        <div className="landing-hero">
          <SynthHero echoes={0} />
          <p className="mt-4 lg:mt-8 text-ink-900 text-base lg:text-xl xl:text-2xl font-medium leading-relaxed max-w-md lg:max-w-lg">
            让每次渴望都完美
          </p>
          <p className="mt-1.5 lg:mt-2 text-ink-700 text-xs lg:text-base max-w-md tracking-wide">
            Let every desire be perfect
          </p>
        </div>

        <div className="landing-cta">
          <div className="flex flex-wrap items-stretch justify-center gap-2 lg:gap-3">
            <div className="feature-badge">
              <div className="title">AI调控</div>
              <div className="desc">体验同频</div>
            </div>
            <div className="feature-badge">
              <div className="title">玩后即焚</div>
              <div className="desc">隐私保护</div>
            </div>
            <div className="feature-badge">
              <div className="title">安全词</div>
              <div className="desc">一声终止</div>
            </div>
          </div>

          <button
            onClick={() => setPage("login")}
            className="btn-start"
            aria-label="进入"
          >
            <span>START</span>
            <span className="arrow" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          <p className="text-xs lg:text-sm text-ink-700 text-center max-w-[320px]">
            美好的体验以彼此自愿、相互尊重为前提
          </p>
        </div>
      </div>
    </div>
  );
}
