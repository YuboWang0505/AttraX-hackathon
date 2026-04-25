import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { useState } from "react";
import type { Role } from "@attrax/shared";
import { useStore } from "../store.js";

const BRAND = "#FF8A3D";

export function Login() {
  const [role, setRole] = useState<Role>("s");
  const [roomCode, setRoomCode] = useState("");
  const [safeWord, setSafeWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const store = useStore();

  const generateRandomCode = () => {
    fetch("/api/room", { method: "POST" })
      .then((r) => r.json())
      .then((d: { code: string }) => setRoomCode(d.code))
      .catch(() => setError("生成 code 失败,请手动输入"));
  };

  async function handleJoin() {
    setError(null);
    let finalCode = roomCode;
    if (!finalCode) {
      try {
        const resp = await fetch("/api/room", { method: "POST" });
        const data: { code: string } = await resp.json();
        finalCode = data.code;
        setRoomCode(finalCode);
      } catch {
        setError("创建房间失败,请检查后端是否运行");
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
        <div className="text-center mb-8 sm:mb-12">
          <motion.h1
            initial={{ y: -10 }}
            animate={{ y: 0 }}
            className="text-5xl sm:text-6xl font-black tracking-tighter mb-3 sm:mb-4"
            style={{ color: BRAND }}
          >
            AttraX
          </motion.h1>
          <div className="inline-flex px-4 py-2 rounded-full bg-black/5 text-[10px] font-black uppercase tracking-[0.25em] text-black/40">
            Remote interaction
          </div>
        </div>

        {/* Role Selection */}
        <div className="mb-6 sm:mb-10">
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

        {/* Fields */}
        <div className="space-y-4 sm:space-y-6 mb-8 sm:mb-12">
          <div className="relative">
            <div className="flex justify-between items-center mb-2 px-4">
              <label className="text-[9px] font-black text-black/20 uppercase tracking-[0.2em]">
                Room Identification
              </label>
              <button
                onClick={generateRandomCode}
                className="text-[9px] font-black uppercase tracking-wider"
                style={{ color: BRAND }}
              >
                Auto
              </button>
            </div>
            <div className="relative group">
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
            </div>
          </div>

          <div className="relative group">
            <label className="block text-[9px] font-black text-black/20 uppercase tracking-[0.2em] mb-2 px-4">
              Safety Constraint
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={16}
                placeholder="安全词"
                value={safeWord}
                onChange={(e) => setSafeWord(e.target.value)}
                className="w-full bg-white/50 hover:bg-white border border-white/80 rounded-full p-5 sm:p-6 text-base font-bold focus:outline-none focus:ring-8 shadow-sm transition-all text-black placeholder:text-black/20 text-center"
                style={{ ["--tw-ring-color" as never]: "rgba(255,138,61,0.05)" }}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-semibold px-4">{error}</p>
          )}
        </div>

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleJoin}
          className="w-full h-16 sm:h-24 bg-black rounded-full text-sm sm:text-lg font-black text-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center justify-center gap-3 sm:gap-4 active:bg-[#FF8A3D] transition-colors shimmer-effect"
        >
          <Users size={22} className="sm:hidden" />
          <Users size={24} className="hidden sm:block" />
          CONNECT SESSION
        </motion.button>
      </motion.div>
    </main>
  );
}
