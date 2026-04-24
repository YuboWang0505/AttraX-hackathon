import { useState } from "react";
import type { Role } from "@attrax/shared";
import { useStore } from "../store.js";

const CODE_LEN = 6;

export function Login() {
  const [role, setRole] = useState<Role | null>(null);
  const [code, setCode] = useState("");
  const [safeWord, setSafeWord] = useState("");
  const [error, setError] = useState<string | null>(null);

  const store = useStore();

  const canSubmit =
    role !== null &&
    (code === "" || /^\d{6}$/.test(code)) &&
    safeWord.length <= 16;

  function handleGenerate() {
    fetch("/api/room", { method: "POST" })
      .then((r) => r.json())
      .then((d: { code: string }) => setCode(d.code))
      .catch(() => setError("生成 code 失败，请手动输入"));
  }

  async function handleSubmit() {
    if (!role) return;
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
    // M must pair BT before entering chat; S skips the gate.
    store.setPage(role === "m" ? "bt_gate" : "chat");
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 sm:p-6 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md bg-ink-800 rounded-card p-6 sm:p-8 border border-ink-700/60 shadow-card">
        <h1 className="text-center text-3xl font-semibold tracking-wide bg-attrax-grad bg-clip-text text-transparent">
          AttraX
        </h1>
        <p className="text-center text-ink-500 text-sm mt-1">
          远程互动 · 脱机演示模式
        </p>

        <div className="mt-8 space-y-6">
          <div>
            <label className="block text-xs text-ink-500 mb-2">角色</label>
            <div className="grid grid-cols-2 gap-3">
              {(["s", "m"] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`py-4 rounded-tile border transition ${
                    role === r
                      ? "bg-accent-500 border-transparent text-white"
                      : "bg-transparent border-ink-700 text-white hover:border-ink-500"
                  }`}
                >
                  <div className="text-lg font-semibold">{r.toUpperCase()}</div>
                  <div className="text-xs opacity-80 mt-1">
                    {r === "s" ? "支配方 · 发消息" : "被支配方 · 佩戴硬件"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-ink-500">房间 Code (6 位数字)</label>
              <button
                onClick={handleGenerate}
                className="text-xs text-accent-500 hover:underline"
              >
                生成随机 code
              </button>
            </div>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={CODE_LEN}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LEN))
              }
              placeholder="留空 + 创建 或 输入对方已有 code"
              className="w-full bg-ink-900 text-white placeholder:text-ink-500 border border-ink-700 rounded-pill px-5 py-3 text-center text-xl font-mono tracking-[0.5em] focus:border-accent-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-ink-500 mb-2">
              安全词（留空使用默认 "安全词"）
            </label>
            <input
              type="text"
              maxLength={16}
              value={safeWord}
              onChange={(e) => setSafeWord(e.target.value)}
              placeholder="安全词"
              className="w-full bg-ink-900 text-white placeholder:text-ink-500 border border-ink-700 rounded-pill px-5 py-3 focus:border-accent-500 outline-none"
            />
            <p className="text-[11px] text-ink-500 mt-1">
              任一方说出安全词，会话立即安全终止。以先进入房间方设置的为准。
            </p>
          </div>

          {error && (
            <p className="text-xs text-danger">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-pill bg-accent-500 hover:bg-accent-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {code ? "加入房间" : "创建房间"}
          </button>
        </div>
      </div>
    </div>
  );
}
