import { useEffect, useState } from "react";
import * as bt from "../lib/bluetooth.js";
import type { BtStatus } from "../lib/bluetooth.js";
import { useStore } from "../store.js";

export function BtGate() {
  const { code, safeWord, setPage, setDemoMode, resetSession } = useStore();
  const [status, setStatus] = useState<BtStatus>(bt.getStatus());

  useEffect(() => bt.subscribe(setStatus), []);

  // Auto-advance once BT is connected
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
    <div className="min-h-full flex items-center justify-center px-4 sm:p-6 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md bg-ink-800 rounded-card p-6 sm:p-8 border border-ink-700/60 shadow-card space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-wide bg-attrax-grad bg-clip-text text-transparent">
            房间已就绪
          </h1>
          <div className="mt-4 font-mono text-4xl tracking-[0.3em] text-white">
            {code}
          </div>
          <div className="mt-2 text-xs text-ink-500">
            把 code 发给对方加入房间
          </div>
          {safeWord && (
            <div className="mt-3 text-xs text-ink-500">
              当前安全词：
              <span className="font-mono text-white ml-1">{safeWord}</span>
            </div>
          )}
        </div>

        <div className="border-t border-ink-700" />

        <div>
          <h2 className="text-sm font-medium text-white mb-2">
            连接你的硬件跳蛋
          </h2>
          <ul className="text-xs text-ink-500 space-y-1 list-disc pl-5">
            <li>开启硬件电源，确保 LED 指示在广播状态</li>
            <li>确认广播名为 <span className="font-mono">Vibration_Egg</span></li>
            <li>
              点下方按钮，在 Chrome 浮层里选择设备后点 "配对"
            </li>
          </ul>
        </div>

        {!supports && (
          <div className="text-xs text-danger border border-danger/40 rounded-tile p-3">
            当前浏览器不支持 Web Bluetooth（需 Chrome / Edge 108+ 且
            HTTPS 或 localhost）。请换浏览器或用演示模式。
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={!supports || connecting || connected}
          className={`w-full py-3 rounded-pill font-medium transition ${
            connected
              ? "bg-ok/20 text-ok border border-ok/60"
              : failed
              ? "bg-danger/80 text-white"
              : "bg-accent-500 hover:bg-accent-600 text-white"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {connected && "✓ 硬件已连接,即将进入聊天…"}
          {connecting && "连接中… 请在浮层中选择设备"}
          {failed && "重试连接"}
          {status === "idle" && "连接蓝牙设备"}
          {status === "offline" && "连接蓝牙设备"}
        </button>

        <div className="text-xs text-center">
          <span
            className={`inline-flex items-center gap-2 ${
              connected
                ? "text-ok"
                : failed
                ? "text-danger"
                : "text-ink-500"
            }`}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connected
                  ? "bg-ok"
                  : connecting
                  ? "bg-warn animate-pulse"
                  : failed
                  ? "bg-danger"
                  : "bg-ink-500"
              }`}
            />
            {connected && "已连硬件"}
            {connecting && "连接中…"}
            {failed && "连接失败,请检查硬件后重试"}
            {status === "idle" && "未连接"}
            {status === "offline" && "演示模式"}
          </span>
        </div>

        <div className="border-t border-ink-700" />

        <div className="flex items-center justify-between text-[11px] text-ink-500">
          <button
            onClick={handleBack}
            className="hover:text-white transition"
          >
            ← 返回登入
          </button>
          <button
            onClick={handleDemoSkip}
            className="hover:text-accent-500 transition underline underline-offset-2"
          >
            没有硬件?切到演示模式
          </button>
        </div>
      </div>
    </div>
  );
}
