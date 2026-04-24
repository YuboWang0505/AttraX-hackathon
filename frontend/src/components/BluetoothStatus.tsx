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

const COLOR: Record<BtStatus, string> = {
  idle: "bg-ink-500",
  connecting: "bg-yellow-500 animate-pulse",
  connected: "bg-emerald-500",
  offline: "bg-synth-orange",
  error: "bg-red-500",
};

interface Props {
  /** When provided, use this status instead of subscribing to local BT. */
  status?: BtStatus | null;
  /** When true, render with peer-facing labels ("对方..."). */
  peer?: boolean;
}

export function BluetoothStatus({ status: override, peer = false }: Props) {
  const [localStatus, setLocalStatus] = useState<BtStatus>(getStatus());
  useEffect(() => {
    if (override !== undefined) return;
    return subscribe(setLocalStatus);
  }, [override]);

  if (peer && override === null) {
    return (
      <div className="inline-flex items-center gap-2 rounded-pill bg-black/70 backdrop-blur px-3 py-1.5 text-xs text-white/80">
        <span className="inline-block w-2 h-2 rounded-full bg-white/40" />
        <span>等待对方硬件</span>
      </div>
    );
  }

  const status = (override ?? localStatus) as BtStatus;
  const label = peer ? PEER_LABEL[status] : SELF_LABEL[status];
  return (
    <div className="inline-flex items-center gap-2 rounded-pill bg-black/70 backdrop-blur px-3 py-1.5 text-xs text-white/80">
      <span className={`inline-block w-2 h-2 rounded-full ${COLOR[status]}`} />
      <span>{label}</span>
    </div>
  );
}
