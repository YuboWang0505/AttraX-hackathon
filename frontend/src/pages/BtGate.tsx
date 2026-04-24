import { useEffect, useState } from "react";
import * as bt from "../lib/bluetooth.js";
import type { BtStatus } from "../lib/bluetooth.js";
import { useStore } from "../store.js";

const STATUS_COPY: Record<BtStatus, string> = {
  idle: "未连接",
  connecting: "正在打开浮层,请选择 Vibration_Egg",
  connected: "✓ 硬件已连接,即将进入聊天…",
  offline: "脱机演示模式",
  error: "连接失败或已取消,请重试",
};

const STATUS_DOT: Record<BtStatus, string> = {
  idle: "bg-white/30",
  connecting: "bg-attrax-warn animate-pulse",
  connected: "bg-attrax-ok",
  offline: "bg-attrax-accent",
  error: "bg-attrax-danger",
};

export function BtGate() {
  const { code, safeWord, setPage, setDemoMode, resetSession } = useStore();
  const [status, setStatus] = useState<BtStatus>(bt.getStatus());

  useEffect(() => bt.subscribe(setStatus), []);

  useEffect(() => {
    if (status === "connected") {
      const t = setTimeout(() => setPage("chat"), 900);
      return () => clearTimeout(t);
    }
    return;
  }, [status, setPage]);

  const supports = bt.supportsWebBluetooth();
  const connecting = status === "connecting";
  const connected = status === "connected";
  const failed = status === "error";

  return (
    <div className="min-h-full bg-attrax-black text-white flex flex-col items-center px-6 pt-8 pb-10">
      <div className="w-full max-w-md flex-1 flex flex-col">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={resetSession}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10"
            aria-label="返回登入"
          >
            ←
          </button>
          <div className="text-[10px] tracking-[0.3em] text-white/30">
            房间 {code}
          </div>
        </div>

        {/* hero title */}
        <div className="mt-16 text-center">
          <h1 className="text-4xl font-semibold tracking-wider">BLUETOOTH</h1>
          <p className="mt-2 text-sm text-white/50">查找你的硬件跳蛋</p>
        </div>

        {/* checklist */}
        <div className="mt-10 bg-white/5 border border-white/10 rounded-card p-5 text-xs text-white/60 space-y-2">
          <div className="flex gap-2">
            <span className="text-attrax-accent">•</span>
            <span>打开硬件电源,LED 指示应处于广播状态</span>
          </div>
          <div className="flex gap-2">
            <span className="text-attrax-accent">•</span>
            <span>
              确认广播名为{" "}
              <span className="font-mono text-white">Vibration_Egg</span>
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-attrax-accent">•</span>
            <span>点下方按钮,在 Chrome 浮层里选设备后点 "配对"</span>
          </div>
        </div>

        {!supports && (
          <div className="mt-4 text-xs text-attrax-danger border border-attrax-danger/40 rounded-tile p-3 bg-attrax-danger/10">
            当前浏览器不支持 Web Bluetooth(需 Chrome / Edge 108+ 且 HTTPS 或
            localhost)。请换浏览器或切演示模式。
          </div>
        )}

        <div className="flex-1" />

        {/* status line */}
        <div className="flex items-center justify-center gap-2 text-xs text-white/70 mb-6">
          <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
          <span>{STATUS_COPY[status]}</span>
        </div>

        {/* orange CTA */}
        <div className="flex justify-center">
          <button
            onClick={() => bt.connect()}
            disabled={!supports || connecting || connected}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition shadow-lg ${
              connected
                ? "bg-attrax-ok text-white shadow-attrax-ok/30"
                : failed
                ? "bg-attrax-danger text-white shadow-attrax-danger/30"
                : "bg-attrax-accent text-white shadow-attrax-accent/30 hover:bg-attrax-accent-dark"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={failed ? "重试连接" : "连接蓝牙"}
          >
            {connected ? "✓" : connecting ? "…" : "→"}
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between text-[11px] text-white/30">
          <span>
            安全词{" "}
            <span className="font-mono text-white/60">{safeWord || "安全词"}</span>
          </span>
          <button
            onClick={() => {
              bt.goOffline();
              setDemoMode(true);
              setPage("chat");
            }}
            className="hover:text-attrax-accent transition underline underline-offset-2"
          >
            没有硬件?演示模式
          </button>
        </div>
      </div>
    </div>
  );
}
