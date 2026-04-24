import { useEffect, useState } from "react";
import * as bt from "../lib/bluetooth.js";
import type { BtStatus } from "../lib/bluetooth.js";
import { useStore } from "../store.js";
import { Aurora } from "../components/Aurora.js";

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

  const primaryLabel = connected
    ? "✓ 已连接"
    : connecting
      ? "连接中…"
      : failed
        ? "重试连接"
        : "扫描设备";

  return (
    <div className="relative min-h-full overflow-hidden bg-stage text-white">
      <Aurora dark />

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-5 md:px-10 pt-[max(1rem,env(safe-area-inset-top))] md:pt-8">
        <button
          onClick={resetSession}
          className="w-10 h-10 md:w-12 md:h-12 rounded-full frost-dark flex items-center justify-center"
          aria-label="back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="text-[11px] md:text-sm text-white/70">
          房间 <span className="font-mono text-white">{code}</span>
          {safeWord && (
            <>
              <span className="mx-2 opacity-40">·</span>
              安全词 <span className="font-mono text-white">{safeWord}</span>
            </>
          )}
        </div>
        <div className="w-10 md:w-12" />
      </div>

      {/* Body */}
      <div className="relative z-10 min-h-[calc(100%-4rem)] flex flex-col md:flex-row items-stretch md:items-center">
        {/* Title + helper copy */}
        <div className="flex-1 md:flex-[1.1] flex flex-col items-center md:items-start justify-center px-6 md:px-16 lg:px-24 pt-10 md:pt-0 pb-4 md:pb-0">
          <div className="max-w-md md:max-w-xl text-center md:text-left">
            <h1 className="h-display text-white">BLUETOOTH</h1>
            <p className="mt-3 md:mt-5 h-sub text-white/85">查找你的设备</p>
            <p className="mt-3 md:mt-4 text-[13px] md:text-base text-white/65 leading-relaxed max-w-md">
              开启硬件电源，确认蓝牙广播指示灯闪烁，然后点右侧扫描按钮配对。
              配对成功后自动进入会话。
            </p>

            {!supports && (
              <div className="mt-5 text-xs md:text-sm text-red-300 border border-red-400/40 rounded-tile p-3 md:p-4 max-w-md">
                当前浏览器不支持 Web Bluetooth（需 Chrome / Edge 108+
                且 HTTPS 或 localhost）。请换浏览器或用演示模式。
              </div>
            )}
          </div>
        </div>

        {/* Device list + CTA */}
        <div className="md:flex-1 flex flex-col items-center md:items-start px-6 md:px-16 lg:px-24 pb-[max(2rem,env(safe-area-inset-bottom))] md:pb-0 gap-6 md:gap-8">
          <div className="w-full max-w-[380px] md:max-w-[440px] frost rounded-[28px] overflow-hidden">
            <DeviceRow
              name="Vibration_Egg"
              subtitle={
                connected
                  ? "已配对"
                  : connecting
                    ? "连接中…"
                    : failed
                      ? "连接失败 · 重试"
                      : "点击下方扫描以发现"
              }
              status={status}
              primary
            />
            <DeviceRow name="检查硬件电源 · LED 闪烁" subtitle="硬件应处于广播状态" />
            <DeviceRow name="靠近手机 (≤ 2m)" subtitle="缩短距离以稳定配对" />
            <DeviceRow name="Chrome / Edge 108+" subtitle="HTTPS 或 localhost 必需" />
            <DeviceRow name="没有硬件？" subtitle="下方切换到演示模式" footer />
          </div>

          <div className="flex items-center gap-4 md:gap-6 w-full max-w-[380px] md:max-w-[440px]">
            <button
              onClick={handleConnect}
              disabled={!supports || connecting || connected}
              className={`btn-orange flex-1 ${
                connected
                  ? "!bg-emerald-500 hover:!bg-emerald-600 shadow-none"
                  : failed
                    ? "!bg-red-500 hover:!bg-red-600"
                    : ""
              }`}
            >
              {primaryLabel}
            </button>
            <button
              onClick={handleDemoSkip}
              className="shrink-0 text-xs md:text-sm text-white/75 hover:text-white underline underline-offset-4 py-2"
            >
              演示模式
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceRow({
  name,
  subtitle,
  status,
  primary,
  footer,
}: {
  name: string;
  subtitle?: string;
  status?: BtStatus;
  primary?: boolean;
  footer?: boolean;
}) {
  const dotColor =
    status === "connected"
      ? "bg-emerald-400"
      : status === "connecting"
        ? "bg-amber-400 animate-pulse"
        : status === "error"
          ? "bg-red-400"
          : "bg-white/40";
  return (
    <div
      className={`flex items-center gap-3 px-5 md:px-6 py-4 md:py-5 ${
        footer ? "" : "border-b border-white/12"
      }`}
    >
      <div
        className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${
          primary ? "bg-synth-orange/22" : "bg-white/10"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M8 6l8 6-8 6V6zM12 2v20M16 8l-4-4M16 16l-4 4"
            stroke={primary ? "#FF8832" : "white"}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`truncate font-medium text-sm md:text-base ${
            primary ? "text-white" : "text-white/85"
          }`}
          style={{ fontFamily: "SF Pro, PingFang SC" }}
        >
          {name}
        </div>
        {subtitle && <div className="text-[11px] md:text-xs text-white/55 truncate mt-0.5">{subtitle}</div>}
      </div>
      {primary && status && (
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
      )}
    </div>
  );
}
