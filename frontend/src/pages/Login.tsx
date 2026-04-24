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
    role !== null && /^\d{6}$/.test(code) && (role === "s" || safeWord.length <= 16);

  function handleGenerate() {
    fetch("/api/room", { method: "POST" })
      .then((r) => r.json())
      .then((d: { code: string }) => setCode(d.code))
      .catch(() => setError("生成 code 失败，请手动输入"));
  }

  function handleSubmit() {
    if (!role) return;
    if (!/^\d{6}$/.test(code)) {
      setError("code 必须为 6 位数字");
      return;
    }
    store.setRole(role);
    store.setCode(code);
    store.setSafeWord(safeWord);
    store.setPage("chat");
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-attrax-panel rounded-card p-8 border border-white/5 shadow-xl">
        <h1 className="text-center text-3xl font-semibold tracking-wide bg-attrax-grad bg-clip-text text-transparent">
          AttraX
        </h1>
        <p className="text-center text-attrax-muted text-sm mt-1">
          远程互动 · 脱机演示模式
        </p>

        <div className="mt-8 space-y-6">
          <div>
            <label className="block text-xs text-attrax-muted mb-2">角色</label>
            <div className="grid grid-cols-2 gap-3">
              {(["s", "m"] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`py-4 rounded-btn border transition ${
                    role === r
                      ? "bg-attrax-grad border-transparent text-white"
                      : "bg-transparent border-white/10 text-attrax-text hover:border-white/30"
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
              <label className="text-xs text-attrax-muted">房间 Code (6 位数字)</label>
              <button
                onClick={handleGenerate}
                className="text-xs text-attrax-accent hover:underline"
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
              placeholder="483921"
              className="w-full bg-attrax-bg border border-white/10 rounded-btn px-4 py-3 text-center text-xl font-mono tracking-[0.5em] focus:border-attrax-accent outline-none"
            />
          </div>

          {role === "m" && (
            <div>
              <label className="block text-xs text-attrax-muted mb-2">
                安全词（留空使用默认 "安全词"）
              </label>
              <input
                type="text"
                maxLength={16}
                value={safeWord}
                onChange={(e) => setSafeWord(e.target.value)}
                placeholder="安全词"
                className="w-full bg-attrax-bg border border-white/10 rounded-btn px-4 py-3 focus:border-attrax-accent outline-none"
              />
              <p className="text-[11px] text-attrax-muted mt-1">
                任一方说出安全词，会话立即安全终止
              </p>
            </div>
          )}

          {role === "s" && (
            <p className="text-xs text-attrax-muted border-l-2 border-attrax-accent/60 pl-3">
              进入聊天后可见 M 端设定的安全词
            </p>
          )}

          {error && (
            <p className="text-xs text-attrax-danger">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-btn bg-attrax-grad text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            开始匹配
          </button>
        </div>
      </div>
    </div>
  );
}
