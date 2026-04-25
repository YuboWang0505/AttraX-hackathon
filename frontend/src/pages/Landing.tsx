import { Aurora } from "../components/Aurora.js";
import { SynthHero } from "../components/SynthHero.js";
import { useStore } from "../store.js";

/**
 * Marketing-style entry screen: SynthHero + Aurora + START button. Sole job
 * is to route to the Login page on START tap. No state of its own. Skipped
 * after a session terminates (resetSession returns to "login", not here).
 */
export function Landing() {
  const setPage = useStore((s) => s.setPage);

  return (
    <div className="relative min-h-full overflow-hidden bg-white">
      <Aurora />

      {/* Portrait: stacked column · Landscape: 55/45 split, both columns vertically centered */}
      <div className="relative z-10 min-h-full flex flex-col md:flex-row items-stretch">
        <div className="flex-1 md:flex-[1.15] flex flex-col justify-center px-7 md:px-16 lg:px-24 pt-[max(3.5rem,env(safe-area-inset-top))] md:pt-0 pb-2 md:pb-0">
          <SynthHero />
          <p className="mt-5 md:mt-10 text-ink-900 text-[15px] md:text-xl lg:text-2xl font-medium leading-relaxed max-w-md md:max-w-lg">
            让声音成为连接彼此<br className="md:hidden" />最温柔的桥梁
          </p>
          <p className="mt-1.5 md:mt-3 text-ink-700 text-[12px] md:text-base max-w-md tracking-wide">
            Voice-driven intimacy · Remote · Safe-word protected
          </p>
        </div>

        <div className="md:flex-1 flex flex-col items-center md:items-start justify-end md:justify-center px-7 md:px-16 lg:px-24 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:pb-0 gap-6 md:gap-10">
          <div className="hidden md:flex items-stretch gap-3 lg:gap-4">
            <div className="feature-badge">
              <div className="title">语音通话</div>
              <div className="desc">实时对讲 · WebRTC</div>
            </div>
            <div className="feature-badge">
              <div className="title">触觉同步</div>
              <div className="desc">蓝牙低功耗</div>
            </div>
            <div className="feature-badge">
              <div className="title">安全词</div>
              <div className="desc">一声即刻终止</div>
            </div>
          </div>

          <button
            onClick={() => setPage("login")}
            className="btn-start w-full sm:w-auto"
            aria-label="进入"
          >
            <span>START</span>
            <span className="arrow" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="md:hidden">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="hidden md:block">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          <p className="text-[12px] md:text-sm text-ink-700 text-center md:text-left max-w-[320px]">
            美好的体验以彼此自愿、相互尊重为前提
          </p>
        </div>
      </div>
    </div>
  );
}
