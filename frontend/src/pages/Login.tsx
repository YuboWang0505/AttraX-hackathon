import { useState } from "react";
import type { Role } from "@attrax/shared";
import { useStore } from "../store.js";
import { Aurora } from "../components/Aurora.js";
import { SynthHero } from "../components/SynthHero.js";

const CODE_LEN = 6;
type Step = "landing" | "invite";

export function Login() {
  const [step, setStep] = useState<Step>("landing");
  const [role, setRole] = useState<Role>("s");
  const [code, setCode] = useState("");
  const [safeWord, setSafeWord] = useState("");
  const [error, setError] = useState<string | null>(null);

  const store = useStore();

  function handleGenerate() {
    fetch("/api/room", { method: "POST" })
      .then((r) => r.json())
      .then((d: { code: string }) => {
        setCode(d.code);
        setError(null);
      })
      .catch(() => setError("生成 code 失败，请手动输入"));
  }

  async function handleSubmit() {
    let finalCode = code;
    if (!finalCode) {
      try {
        const resp = await fetch("/api/room", { method: "POST" });
        const data: { code: string } = await resp.json();
        finalCode = data.code;
        setCode(finalCode);
      } catch {
        setError("创建房间失败，请检查后端是否运行");
        return;
      }
    }
    if (!/^\d{6}$/.test(finalCode)) {
      setError("code 必须为 6 位数字");
      return;
    }
    store.setRole(role);
    store.setCode(finalCode);
    store.setSafeWord(safeWord);
    store.setDemoMode(false);
    store.setPage(role === "m" ? "bt_gate" : "chat");
  }

  if (step === "landing") {
    return <Landing onStart={() => setStep("invite")} />;
  }

  return (
    <Invite
      role={role}
      setRole={setRole}
      code={code}
      setCode={setCode}
      safeWord={safeWord}
      setSafeWord={setSafeWord}
      error={error}
      onBack={() => setStep("landing")}
      onGenerate={handleGenerate}
      onSubmit={handleSubmit}
    />
  );
}

/* ---------------- Landing (开始页) ---------------- */

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative min-h-full overflow-hidden bg-white">
      <Aurora />

      {/* Portrait: stacked column · Landscape: 55/45 split, both columns vertically centered */}
      <div className="relative z-10 min-h-full flex flex-col md:flex-row items-stretch">
        {/* Hero — left on landscape, top on portrait */}
        <div className="flex-1 md:flex-[1.15] flex flex-col justify-center px-7 md:px-16 lg:px-24 pt-[max(3.5rem,env(safe-area-inset-top))] md:pt-0 pb-2 md:pb-0">
          <SynthHero />
          <p className="mt-5 md:mt-10 text-ink-900 text-[15px] md:text-xl lg:text-2xl font-medium leading-relaxed max-w-md md:max-w-lg">
            让声音成为连接彼此<br className="md:hidden" />最温柔的桥梁
          </p>
          <p className="mt-1.5 md:mt-3 text-ink-700 text-[12px] md:text-base max-w-md tracking-wide">
            Voice-driven intimacy · Remote · Safe-word protected
          </p>
        </div>

        {/* CTA — right on landscape, bottom on portrait */}
        <div className="md:flex-1 flex flex-col items-center md:items-start justify-end md:justify-center px-7 md:px-16 lg:px-24 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:pb-0 gap-6 md:gap-10">
          {/* Feature row — desktop only (balances the left hero) */}
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

          <button onClick={onStart} className="btn-start w-full sm:w-auto">
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

/* ---------------- Invite (邀请页) ---------------- */

interface InviteProps {
  role: Role;
  setRole: (r: Role) => void;
  code: string;
  setCode: (s: string) => void;
  safeWord: string;
  setSafeWord: (s: string) => void;
  error: string | null;
  onBack: () => void;
  onGenerate: () => void;
  onSubmit: () => void;
}

function Invite({
  role,
  setRole,
  code,
  setCode,
  safeWord,
  setSafeWord,
  error,
  onBack,
  onGenerate,
  onSubmit,
}: InviteProps) {
  const digits = code.padEnd(CODE_LEN, "·").split("");

  return (
    <div className="relative min-h-full overflow-hidden bg-stage text-white">
      <Aurora dark />

      {/* Top bar — back + S/M segmented */}
      <div className="relative z-20 flex items-center justify-between px-5 md:px-10 pt-[max(1rem,env(safe-area-inset-top))] md:pt-8">
        <button
          onClick={onBack}
          className="w-10 h-10 md:w-12 md:h-12 rounded-full frost-dark flex items-center justify-center text-white/90 hover:text-white"
          aria-label="back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex gap-1 p-1 rounded-pill bg-white/18 backdrop-blur text-sm md:text-base font-semibold">
          {(["s", "m"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`min-w-[64px] md:min-w-[80px] py-1.5 md:py-2 px-4 md:px-5 rounded-pill transition ${
                role === r ? "bg-white text-black" : "text-white/85"
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 min-h-[calc(100%-4rem)] flex flex-col md:flex-row items-stretch md:items-center">
        {/* Left/top — title + code pills */}
        <div className="flex-1 md:flex-[1.1] flex flex-col items-center md:items-start justify-center px-6 md:px-16 lg:px-24 pt-8 md:pt-0 pb-2 md:pb-0">
          <div className="w-full max-w-md md:max-w-xl text-center md:text-left">
            <h1 className="h-display text-white">YOUR CODE</h1>
            <div className="mt-4 md:mt-6 flex items-center justify-center md:justify-start gap-3 md:gap-4 code-hint text-white/75">
              <span>2</span>
              <span>4</span>
              <span>2</span>
              <span>6</span>
              <button
                onClick={onGenerate}
                className="ml-2 w-9 h-9 md:w-10 md:h-10 rounded-full border border-white/40 flex items-center justify-center hover:bg-white/10 transition"
                aria-label="generate code"
                title="生成随机 code"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M4 4v4h4M20 20v-4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Digit pills row */}
            <label className="mt-7 md:mt-10 flex items-center justify-center md:justify-start gap-2.5 md:gap-3.5 relative cursor-text">
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={CODE_LEN}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LEN))
                }
                className="absolute inset-0 opacity-0"
                autoFocus
              />
              {digits.map((d, i) => (
                <span
                  key={i}
                  className="digit-pill"
                  style={{ color: d === "·" ? "rgba(0,0,0,0.16)" : "#000" }}
                >
                  {d}
                </span>
              ))}
            </label>

            <p className="mt-4 md:mt-5 text-[12px] md:text-sm text-white/60 text-center md:text-left">
              把这 6 位数字发给对方，即可加入同一房间
            </p>
          </div>
        </div>

        {/* Right/bottom — safe word + submit */}
        <div className="md:flex-1 flex flex-col items-center md:items-start justify-end md:justify-center px-6 md:px-16 lg:px-24 pb-[max(2rem,env(safe-area-inset-bottom))] md:pb-0 gap-5 md:gap-7">
          <div className="w-full max-w-[320px] md:max-w-[420px]">
            <label className="block text-xs md:text-sm text-white/80 mb-2 md:mb-3 uppercase tracking-[0.2em] font-semibold">
              安全词 (safe word)
            </label>
            <div className="inline-flex items-center gap-3 bg-black/40 border border-white/15 rounded-pill px-5 py-3 md:py-4 w-full">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white/80 shrink-0 md:w-5 md:h-5">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                type="text"
                maxLength={16}
                value={safeWord}
                onChange={(e) => setSafeWord(e.target.value)}
                placeholder="安全词"
                className="flex-1 bg-transparent outline-none text-white text-base md:text-lg placeholder:text-white/45"
              />
            </div>
            <p className="mt-2 md:mt-3 text-[11px] md:text-xs text-white/60">
              任一方说出安全词，会话立刻终止。留空则使用默认 "安全词"
            </p>
            {error && <p className="mt-3 text-xs md:text-sm text-red-300">{error}</p>}
          </div>

          <button onClick={onSubmit} className="btn-orange w-full max-w-[320px] md:max-w-[360px]">
            {code ? "加入房间" : "创建房间"}
          </button>

          <p className="hidden md:block text-xs text-white/55 max-w-[360px]">
            美好的体验以彼此自愿、相互尊重为前提
          </p>
        </div>
      </div>
    </div>
  );
}
