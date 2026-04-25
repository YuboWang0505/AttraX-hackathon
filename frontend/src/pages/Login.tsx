import { AnimatePresence, motion } from "framer-motion";
import { Users } from "lucide-react";
import { useState } from "react";
import type { Role } from "@attrax/shared";
import { useStore } from "../store.js";

const BRAND = "#FF8A3D";

type Mode = "create" | "join";

export function Login() {
  const [mode, setMode] = useState<Mode>("create");
  const [role, setRole] = useState<Role>("s");
  const [roomCode, setRoomCode] = useState("");
  const [safeWord, setSafeWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const store = useStore();

  // Create-mode requires a safe word: it's the only opportunity to set it,
  // and the partner who joins later will inherit whatever this user picks.
  // Join-mode has no safe-word field — the creator already set it.
  const canSubmit =
    mode === "create"
      ? safeWord.trim().length > 0 && safeWord.length <= 16
      : /^\d{6}$/.test(roomCode);

  function clearFieldsForMode(next: Mode) {
    setError(null);
    setMode(next);
  }

  async function handleSubmit() {
    setError(null);
    if (mode === "create") {
      if (!safeWord.trim()) {
        setError("创建房间必须设置安全词");
        return;
      }
      try {
        // Backend now materializes the Room here (with our safe word) so
        // that a joiner with this code can never accidentally land in an
        // empty room while we're still pairing BT.
        const resp = await fetch("/api/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ safeWord: safeWord.trim() }),
        });
        const data: { code: string } = await resp.json();
        store.setRole(role);
        store.setCode(data.code);
        store.setSafeWord(safeWord.trim());
        store.setDemoMode(false);
        store.setIsCreator(true);
        store.setPage(role === "m" ? "bt_gate" : "chat");
      } catch {
        setError("创建房间失败,请检查后端是否运行");
      }
      return;
    }
    // join
    if (!/^\d{6}$/.test(roomCode)) {
      setError("请输入对方告知的 6 位 code");
      return;
    }
    store.setRole(role);
    store.setCode(roomCode);
    store.setSafeWord(""); // joiner inherits the creator's safe word
    store.setDemoMode(false);
    store.setIsCreator(false);
    store.setPage(role === "m" ? "bt_gate" : "chat");
  }

  return (
    <main className="min-h-full w-full flex items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] relative overflow-hidden">
      <div className="mesh-bg" />
      <div className="mesh-glow" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-md bg-white/40 backdrop-blur-3xl p-6 sm:p-10 rounded-[2.25rem] sm:rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.06)] border border-white/60 relative overflow-hidden"
      >
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <motion.h1
            initial={{ y: -10 }}
            animate={{ y: 0 }}
            className="text-2xl sm:text-3xl font-black tracking-tighter mb-3 sm:mb-4 whitespace-nowrap"
            style={{ color: BRAND }}
          >
            Synesthesia Lab
          </motion.h1>
          <div className="inline-flex px-4 py-2 rounded-full bg-black/5 text-[10px] font-black uppercase tracking-[0.25em] text-black/40">
            Remote interaction
          </div>
        </div>

        {/* Mode tabs — Create vs Join */}
        <div className="mb-6 sm:mb-8">
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/5 rounded-full">
            {(["create", "join"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => clearFieldsForMode(m)}
                className={`relative py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.25em] transition-all ${
                  mode === m
                    ? "bg-white text-black shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
                    : "text-black/40 hover:text-black/60"
                }`}
              >
                {m === "create" ? "Create · 创建" : "Join · 加入"}
              </button>
            ))}
          </div>
        </div>

        {/* Role Selection */}
        <div className="mb-6 sm:mb-8">
          <label className="block text-[10px] font-black text-black/20 uppercase tracking-[0.2em] mb-3 sm:mb-4 ml-4">
            Identity Profile
          </label>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              onClick={() => setRole("s")}
              className={`group relative p-4 sm:p-6 h-32 sm:h-40 rounded-[2rem] sm:rounded-[2.5rem] border-2 transition-all duration-500 text-left ${
                role === "s"
                  ? "bg-white/80 shadow-[0_20px_40px_rgba(255,138,61,0.15)] scale-[1.02]"
                  : "border-white/40 bg-white/30 hover:bg-white/60"
              }`}
              style={role === "s" ? { borderColor: BRAND } : undefined}
            >
              <div
                className="text-3xl sm:text-4xl font-black mb-1.5 sm:mb-2"
                style={{ color: role === "s" ? BRAND : "rgba(0,0,0,0.2)" }}
              >
                S
              </div>
              <div className="text-[10px] text-black/40 font-black leading-tight tracking-wider">
                DOMINANT
                <br />
                CONTROLLER
              </div>
              {role === "s" && (
                <div
                  className="absolute top-4 right-4 sm:top-6 sm:right-6 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: BRAND }}
                />
              )}
            </button>
            <button
              onClick={() => setRole("m")}
              className={`group relative p-4 sm:p-6 h-32 sm:h-40 rounded-[2rem] sm:rounded-[2.5rem] border-2 transition-all duration-500 text-left ${
                role === "m"
                  ? "bg-white/80 shadow-[0_20px_40px_rgba(255,138,61,0.15)] scale-[1.02]"
                  : "border-white/40 bg-white/30 hover:bg-white/60"
              }`}
              style={role === "m" ? { borderColor: BRAND } : undefined}
            >
              <div
                className="text-3xl sm:text-4xl font-black mb-1.5 sm:mb-2"
                style={{ color: role === "m" ? BRAND : "rgba(0,0,0,0.2)" }}
              >
                M
              </div>
              <div className="text-[10px] text-black/40 font-black leading-tight tracking-wider">
                SUBMISSIVE
                <br />
                DEVICE SYNC
              </div>
              {role === "m" && (
                <div
                  className="absolute top-4 right-4 sm:top-6 sm:right-6 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: BRAND }}
                />
              )}
            </button>
          </div>
        </div>

        {/* Mode-specific fields */}
        <div className="mb-8 sm:mb-12 min-h-[120px]">
          <AnimatePresence mode="wait">
            {mode === "create" ? (
              <motion.div
                key="create-field"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="relative group"
              >
                <div className="flex justify-between items-center mb-2 px-4">
                  <label className="text-[9px] font-black text-black/20 uppercase tracking-[0.2em]">
                    Safety Constraint · 安全词
                  </label>
                  <span
                    className="text-[9px] font-black uppercase tracking-wider"
                    style={{ color: BRAND }}
                  >
                    Required
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={16}
                  placeholder="必须设置安全词"
                  value={safeWord}
                  onChange={(e) => setSafeWord(e.target.value)}
                  className="w-full bg-white/50 hover:bg-white border border-white/80 rounded-full p-5 sm:p-6 text-base font-bold focus:outline-none focus:ring-8 shadow-sm transition-all text-black placeholder:text-black/20 text-center"
                  style={{ ["--tw-ring-color" as never]: "rgba(255,138,61,0.05)" }}
                />
                <p className="text-[10px] text-black/30 mt-2 px-4 leading-relaxed">
                  双方任一方说出安全词即立刻终止会话。房间号将由系统自动生成。
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="join-field"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="relative group"
              >
                <div className="flex justify-between items-center mb-2 px-4">
                  <label className="text-[9px] font-black text-black/20 uppercase tracking-[0.2em]">
                    Room Code · 房间号
                  </label>
                  <span
                    className="text-[9px] font-black uppercase tracking-wider"
                    style={{ color: BRAND }}
                  >
                    6 digits
                  </span>
                </div>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  type="text"
                  placeholder="000 000"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full bg-white/50 hover:bg-white border border-white/80 rounded-full p-5 sm:p-6 text-lg sm:text-xl font-bold tracking-[0.2em] focus:outline-none focus:ring-8 shadow-sm transition-all text-black placeholder:text-black/20 text-center"
                  style={{ ["--tw-ring-color" as never]: "rgba(255,138,61,0.05)" }}
                />
                <p className="text-[10px] text-black/30 mt-2 px-4 leading-relaxed">
                  使用对方告知的 6 位房间号。安全词由创建方设置,你将自动继承。
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <p className="text-xs text-red-500 font-semibold px-4 mb-4 -mt-4">
            {error}
          </p>
        )}

        <motion.button
          whileHover={canSubmit ? { y: -2 } : undefined}
          whileTap={canSubmit ? { scale: 0.98 } : undefined}
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full h-16 sm:h-24 bg-black rounded-full text-sm sm:text-lg font-black text-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center justify-center gap-3 sm:gap-4 active:bg-[#FF8A3D] transition-colors shimmer-effect disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Users size={22} className="sm:hidden" />
          <Users size={24} className="hidden sm:block" />
          {mode === "create" ? "CREATE SESSION" : "JOIN SESSION"}
        </motion.button>
      </motion.div>
    </main>
  );
}
