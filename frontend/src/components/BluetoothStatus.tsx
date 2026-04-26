import { useEffect, useState } from "react";
import { useT } from "../i18n/index.js";
import type { StringKey } from "../i18n/strings.js";
import { getStatus, subscribe, type BtStatus } from "../lib/bluetooth.js";

const SELF_LABEL: Record<BtStatus, StringKey> = {
  idle: "chat.btself.idle",
  connecting: "chat.btself.connecting",
  connected: "chat.btself.connected",
  offline: "chat.btself.offline",
  error: "chat.btself.error",
};

const PEER_LABEL: Record<BtStatus, StringKey> = {
  idle: "chat.btpeer.idle",
  connecting: "chat.btpeer.connecting",
  connected: "chat.btpeer.connected",
  offline: "chat.btpeer.offline",
  error: "chat.btpeer.error",
};

const COLOR: Record<BtStatus, string> = {
  idle: "bg-attrax-muted",
  connecting: "bg-yellow-500 animate-pulse",
  connected: "bg-emerald-500",
  offline: "bg-attrax-accent",
  error: "bg-attrax-danger",
};

interface Props {
  /** When provided, use this status instead of subscribing to local BT. */
  status?: BtStatus | null;
  /** When true, render with peer-facing labels ("对方..."). */
  peer?: boolean;
}

export function BluetoothStatus({ status: override, peer = false }: Props) {
  const [localStatus, setLocalStatus] = useState<BtStatus>(getStatus());
  const t = useT();
  useEffect(() => {
    if (override !== undefined) return;
    return subscribe(setLocalStatus);
  }, [override]);

  if (peer && override === null) {
    return (
      <div className="inline-flex items-center gap-2 rounded-btn bg-attrax-panel/70 px-2 py-1 text-xs border border-white/5">
        <span className="inline-block w-2 h-2 rounded-full bg-attrax-muted" />
        <span className="text-attrax-muted">{t("chat.btpeer.waiting")}</span>
      </div>
    );
  }

  const status = (override ?? localStatus) as BtStatus;
  const labelKey = peer ? PEER_LABEL[status] : SELF_LABEL[status];
  return (
    <div className="inline-flex items-center gap-2 rounded-btn bg-attrax-panel/70 px-2 py-1 text-xs border border-white/5">
      <span className={`inline-block w-2 h-2 rounded-full ${COLOR[status]}`} />
      <span className="text-attrax-muted">{t(labelKey)}</span>
    </div>
  );
}
