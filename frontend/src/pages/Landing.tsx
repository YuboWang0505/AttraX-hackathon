import { SynthHero } from "../components/SynthHero.js";
import { useStore } from "../store.js";

/**
 * Marketing-style entry screen.
 *
 * Layout:
 *  - Phones in portrait (<500px): single-column stack — hero on top, CTA
 *    below. Common phone widths (360–430px) all land here.
 *  - ≥500px: left/right split. Custom breakpoint (not sm/md) because user's
 *    Win Chrome has heavy sidebar pressure that shrinks effective viewport
 *    below 640/768; 500px ensures split layout on any desktop window.
 */
export function Landing() {
  const setPage = useStore((s) => s.setPage);

  return (
    <div className="relative h-full w-full overflow-y-auto min-[500px]:overflow-hidden">
      {/* Same scene background as Login / BtGate / Chat — light pastel mesh
          (淡蓝 → 奶油 → 浅粉)+ subtle orange/blue glow. The outer div
          intentionally has NO bg-white so the fixed-position mesh-bg can
          show through underneath the page content. */}
      <div className="mesh-bg" />
      <div className="mesh-glow" />

      <div className="relative z-10 min-h-full w-full flex flex-col min-[500px]:flex-row items-stretch">
        {/* Hero — top on mobile, left on sm+. echoes=0 disables the
            ghost-shadow layers so the hero text matches the flat weight
            used on Login / Chat / BtGate. */}
        <div className="flex-1 min-[500px]:flex-[1.15] flex flex-col items-center justify-center px-6 lg:px-16 xl:px-24 pt-[max(2rem,env(safe-area-inset-top))] min-[500px]:pt-6 pb-4 min-[500px]:pb-6 text-center">
          <SynthHero echoes={0} />
          <p className="mt-4 min-[500px]:mt-5 lg:mt-8 text-ink-900 text-base min-[500px]:text-lg lg:text-xl xl:text-2xl font-medium leading-relaxed max-w-md lg:max-w-lg">
            让每次渴望都完美
          </p>
          <p className="mt-1.5 lg:mt-2 text-ink-700 text-xs min-[500px]:text-sm lg:text-base max-w-md tracking-wide">
            Let every desire be perfect
          </p>
        </div>

        {/* CTA — bottom on mobile, right on sm+. */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-16 xl:px-24 pt-2 min-[500px]:pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] min-[500px]:pb-6 gap-5 lg:gap-8 text-center">
          {/* Feature row — flex-wrap lets the 3 chips wrap to a 2nd row on
              narrow viewports so they never overflow. */}
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

          <p className="text-xs min-[500px]:text-sm text-ink-700 text-center max-w-[320px]">
            美好的体验以彼此自愿、相互尊重为前提
          </p>
        </div>
      </div>
    </div>
  );
}
