import { useEffect, useState } from "react";
import { getStatus, subscribe, type BtStatus } from "../lib/bluetooth.js";

const SELF_LABEL: Record<BtStatus, string> = {
  idle: "未连接",
  connecting: "连接中…",
  connected: "已连硬件",
  offline: "脱机模式",
  error: "连接失败",
};

const PEER_LABEL: Record<BtStatus, string> = {
  idle: "对方未就绪",
  connecting: "对方连接中…",
  connected: "对方硬件就绪",
  offline: "对方演示模式",
  error: "对方连接异常",
};

const DOT: Record<BtStatus, string> = {
  idle: "bg-black/30",
  connecting: "bg-attrax-warn animate-pulse",
  connected: "bg-attrax-ok",
  offline: "bg-attrax-accent",
  error: "bg-attrax-danger",
};

interface Props {
  status?: BtStatus | null;
  peer?: boolean;
  /** when true, render on a dark background (Login/BtGate) rather than light (Chat) */
  dark?: boolean;
}

export function BluetoothStatus({
  status: override,
  peer = false,
  dark = false,
}: Props) {
  const [localStatus, setLocalStatus] = useState<BtStatus>(getStatus());
  useEffect(() => {
    if (override !== undefined) return;
    return subscribe(setLocalStatus);
  }, [override]);

  const wrap = dark
    ? "bg-white/5 border border-white/10 text-white/60"
    : "bg-white border border-black/5 text-attrax-chat-muted shadow-sm";

  if (peer && override === null) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-pill px-2.5 py-1 text-xs ${wrap}`}
      >
        <span className="inline-block w-2 h-2 rounded-full bg-black/30" />
        <span>等待对方硬件</span>
      </div>
    );
  }

  const status = (override ?? localStatus) as BtStatus;
  const label = peer ? PEER_LABEL[status] : SELF_LABEL[status];
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-pill px-2.5 py-1 text-xs ${wrap}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${DOT[status]}`} />
      <span>{label}</span>
    </div>
  );
}
