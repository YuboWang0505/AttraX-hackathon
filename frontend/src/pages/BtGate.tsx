import { motion } from "framer-motion";
import { Bluetooth } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyCode } from "../components/CopyCode.js";
import { LangToggle } from "../components/LangToggle.js";
import { useT } from "../i18n/index.js";
import * as bt from "../lib/bluetooth.js";
import type { BtStatus } from "../lib/bluetooth.js";
import { useStore } from "../store.js";

const BRAND = "#FF8A3D";

export function BtGate() {
  const { code, safeWord, setPage, setDemoMode, resetSession } = useStore();
  const [status, setStatus] = useState<BtStatus>(bt.getStatus());
  const t = useT();

  useEffect(() => bt.subscribe(setStatus), []);

  useEffect(() => {
    if (status === "connected") {
      const t = setTimeout(() => setPage("chat"), 900);
      return () => clearTimeout(t);
    }
    return;
  }, [status, setPage]);

  const connecting = status === "connecting";
  const connected = status === "connected";
  const failed = status === "error";
  const supports = bt.supportsWebBluetooth();

  async function handleConnect() {
    await bt.connect();
  }

  function handleDemoSkip() {
    bt.goOffline();
    setDemoMode(true);
    setPage("chat");
  }

  function handleBack() {
    resetSession();
  }

  return (
    <main className="min-h-full w-full flex items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] relative overflow-hidden">
      <div className="mesh-bg" />
      <div className="mesh-glow" />

      <LangToggle className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-20" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white/40 backdrop-blur-3xl p-6 sm:p-10 rounded-[2.25rem] sm:rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.06)] border border-white/60 relative overflow-hidden"
      >
        {/* Header — same rhythm as Login: pill tag + huge value + soft sub */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex px-4 py-2 rounded-full bg-black/5 text-[10px] font-black uppercase tracking-[0.25em] text-black/40 mb-4 sm:mb-6">
            Room Ready
          </div>
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span
              className="font-black tracking-[0.25em] text-5xl sm:text-6xl"
              style={{ color: BRAND }}
            >
              {code}
            </span>
            <CopyCode code={code} size={20} />
          </div>
          <div className="text-[10px] font-black text-black/30 uppercase tracking-[0.25em]">
            {t("bt.tip3")}
          </div>
          {safeWord && (
            <div className="mt-4 sm:mt-5 inline-flex items-center gap-2 bg-white/60 border border-white/80 px-4 py-2 rounded-full shadow-sm">
              <span className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em]">
                Safety
              </span>
              <span className="font-bold text-black text-sm">{safeWord}</span>
            </div>
          )}
        </div>

        {!supports && (
          <div className="mb-5 sm:mb-6 bg-red-50 border border-red-200 rounded-[1.5rem] sm:rounded-[2rem] px-4 sm:px-5 py-3 sm:py-4 text-xs text-red-600 font-semibold leading-relaxed">
            当前浏览器不支持 Web Bluetooth(需 Chrome / Edge 108+ 且
            HTTPS 或 localhost)。请换浏览器或用演示模式。
          </div>
        )}

        {/* Primary CTA — matches Login's CONNECT SESSION button */}
        <motion.button
          whileHover={!connected && !connecting ? { y: -2 } : undefined}
          whileTap={!connected && !connecting ? { scale: 0.98 } : undefined}
          onClick={handleConnect}
          disabled={!supports || connecting || connected}
          className={`w-full h-16 sm:h-24 rounded-full text-sm sm:text-lg font-black flex items-center justify-center gap-3 sm:gap-4 transition-colors disabled:cursor-not-allowed ${
            connected
              ? "bg-emerald-500 text-white shadow-[0_20px_50px_rgba(16,185,129,0.3)]"
              : failed
              ? "bg-red-500 text-white shadow-[0_20px_50px_rgba(239,68,68,0.25)]"
              : "bg-black text-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] shimmer-effect"
          }`}
        >
          <Bluetooth size={22} className="sm:hidden" />
          <Bluetooth size={24} className="hidden sm:block" />
          {connected
            ? "HARDWARE READY"
            : connecting
            ? "CONNECTING..."
            : failed
            ? "RETRY CONNECT"
            : "CONNECT DEVICE"}
        </motion.button>

        {/* Status row */}
        <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected
                ? "bg-emerald-500"
                : connecting
                ? "bg-yellow-500 animate-pulse"
                : failed
                ? "bg-red-500"
                : status === "offline"
                ? ""
                : "bg-black/20"
            }`}
            style={
              status === "offline" && !connected && !connecting && !failed
                ? { backgroundColor: BRAND }
                : undefined
            }
          />
          <span
            className={
              connected
                ? "text-emerald-600"
                : connecting
                ? "text-yellow-600"
                : failed
                ? "text-red-500"
                : "text-black/40"
            }
          >
            {connected
              ? "已连硬件"
              : connecting
              ? "连接中…"
              : failed
              ? "连接失败,请检查硬件后重试"
              : status === "offline"
              ? "演示模式"
              : "未连接"}
          </span>
        </div>

        {/* Footer actions */}
        <div className="mt-6 sm:mt-10 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em]">
          <button
            onClick={handleBack}
            className="text-black/40 hover:text-black transition"
          >
            ← {t("bt.back")}
          </button>
          <button
            onClick={handleDemoSkip}
            className="hover:opacity-80 transition"
            style={{ color: BRAND }}
          >
            {t("bt.demo.skip")}
          </button>
        </div>
      </motion.div>
    </main>
  );
}
