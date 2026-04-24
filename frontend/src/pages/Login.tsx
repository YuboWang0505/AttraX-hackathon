import { useRef, useState } from "react";
import type { Role } from "@attrax/shared";
import { useStore } from "../store.js";

const CODE_LEN = 6;

export function Login() {
  const [role, setRole] = useState<Role | null>(null);
  const [code, setCode] = useState("");
  const [safeWord, setSafeWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const store = useStore();

  const canSubmit =
    role !== null &&
    (code === "" || /^\d{6}$/.test(code)) &&
    safeWord.length <= 16 &&
    !submitting;

  async function handleGenerate() {
    try {
      const resp = await fetch("/api/room", { method: "POST" });
      const data: { code: string } = await resp.json();
      setCode(data.code);
    } catch {
      setError("生成 code 失败,请手动输入");
    }
  }

  async function handleSubmit() {
    if (!role) return;
    setSubmitting(true);
    let finalCode = code;
    if (!finalCode) {
      try {
        const resp = await fetch("/api/room", { method: "POST" });
        const data: { code: string } = await resp.json();
        finalCode = data.code;
        setCode(finalCode);
      } catch {
        setError("创建房间失败,请检查后端是否运行");
        setSubmitting(false);
        return;
      }
    }
    if (!/^\d{6}$/.test(finalCode)) {
      setError("code 必须为 6 位数字");
      setSubmitting(false);
      return;
    }
    store.setRole(role);
    store.setCode(finalCode);
    store.setSafeWord(safeWord);
    store.setDemoMode(false);
    store.setPage(role === "m" ? "bt_gate" : "chat");
  }

  const focusCode = () => codeInputRef.current?.focus();

  return (
    <div className="min-h-full bg-attrax-black text-white flex flex-col items-center px-6 pt-12 pb-8">
      <div className="w-full max-w-md flex-1 flex flex-col">
        <div className="mb-10 text-center">
          <div className="text-xs tracking-[0.3em] text-white/40 uppercase">
            AttraX
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-wider">
            YOUR CODE
          </h1>
          <button
            onClick={handleGenerate}
            className="mt-3 text-xs tracking-[0.2em] text-white/40 hover:text-white/70 transition"
          >
            随机生成 ↻
          </button>
        </div>

        {/* 6 pill digit boxes + invisible input capturing keyboard */}
        <div className="relative" onClick={focusCode}>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: CODE_LEN }, (_, i) => {
              const ch = code[i];
              return (
                <div
                  key={i}
                  className={`aspect-[3/4] rounded-tile flex items-center justify-center text-2xl font-semibold transition ${
                    ch
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/40 border border-white/10"
                  }`}
                >
                  {ch ?? ""}
                </div>
              );
            })}
          </div>
          <input
            ref={codeInputRef}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={CODE_LEN}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LEN))
            }
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="输入 6 位数字 code,或留空自动创建"
          />
        </div>

        <p className="mt-2 text-[11px] text-center text-white/30">
          留空 + 下一步 = 创建新房间
        </p>

        {/* S/M segmented toggle */}
        <div className="mt-10 flex justify-center">
          <div className="relative inline-flex bg-white/10 rounded-pill p-1 w-48">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-pill bg-white transition-all duration-200 ${
                role === "m" ? "left-[calc(50%+0px)]" : "left-1"
              } ${role === null ? "opacity-0" : "opacity-100"}`}
            />
            {(["s", "m"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`relative flex-1 py-2 text-sm font-semibold uppercase tracking-wider transition-colors z-10 ${
                  role === r ? "text-black" : "text-white/60"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* safe word input */}
        <div className="mt-8">
          <input
            type="text"
            maxLength={16}
            value={safeWord}
            onChange={(e) => setSafeWord(e.target.value)}
            placeholder="安全词 (留空默认 安全词)"
            className="w-full bg-white/10 border border-white/10 rounded-pill px-5 py-3 text-sm placeholder-white/30 focus:border-attrax-accent outline-none"
          />
          <p className="mt-2 text-[11px] text-center text-white/30">
            任一方说出安全词会话立即终止 · 以先进入者设置为准
          </p>
        </div>

        {error && (
          <p className="mt-4 text-xs text-center text-attrax-danger">{error}</p>
        )}

        <div className="flex-1" />

        {/* submit button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-16 h-16 rounded-full bg-attrax-accent text-white flex items-center justify-center text-2xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-attrax-accent-dark transition shadow-lg shadow-attrax-accent/30"
            aria-label="下一步"
          >
            →
          </button>
        </div>

        {role && (
          <p className="mt-3 text-[11px] text-center text-white/30">
            {role === "s" ? "你将作为支配方进入聊天" : "下一步将连接硬件"}
          </p>
        )}
      </div>
    </div>
  );
}
