import { useEffect, useState } from "react";
import { getStatus, subscribe, type BtStatus } from "../lib/bluetooth.js";

const LABEL: Record<BtStatus, string> = {
  idle: "未连接",
  connecting: "连接中…",
  connected: "已连硬件",
  offline: "脱机模式",
  error: "连接失败",
};

const COLOR: Record<BtStatus, string> = {
  idle: "bg-attrax-muted",
  connecting: "bg-yellow-500 animate-pulse",
  connected: "bg-emerald-500",
  offline: "bg-attrax-accent",
  error: "bg-attrax-danger",
};

export function BluetoothStatus() {
  const [status, setStatus] = useState<BtStatus>(getStatus());
  useEffect(() => subscribe(setStatus), []);
  return (
    <div className="inline-flex items-center gap-2 rounded-btn bg-attrax-panel/70 px-2 py-1 text-xs border border-white/5">
      <span className={`inline-block w-2 h-2 rounded-full ${COLOR[status]}`} />
      <span className="text-attrax-muted">{LABEL[status]}</span>
    </div>
  );
}
