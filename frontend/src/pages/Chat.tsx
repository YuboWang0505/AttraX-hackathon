import { useEffect, useMemo, useRef, useState } from "react";
import type { ServerMsg } from "@attrax/shared";
import { BluetoothStatus } from "../components/BluetoothStatus.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { IntensityViz } from "../components/IntensityViz.js";
import * as bt from "../lib/bluetooth.js";
import type { BtStatus } from "../lib/bluetooth.js";
import { connect, type WsHandle } from "../lib/ws.js";
import { useStore } from "../store.js";

export function Chat() {
  const {
    role,
    code,
    safeWord,
    messages,
    intensity,
    demoMode,
    connection,
    setConnection,
    appendMessage,
    setSafeWord,
    terminate,
  } = useStore();

  const [input, setInput] = useState("");
  const [terminatedBanner, setTerminatedBanner] = useState<{
    visible: boolean;
    reason: "safe_word" | "peer_left" | null;
  }>({ visible: false, reason: null });
  const [btInterrupted, setBtInterrupted] = useState(false);
  const [btReconnecting, setBtReconnecting] = useState(false);
  const [peerBtStatus, setPeerBtStatus] = useState<BtStatus | null>(null);

  const wsRef = useRef<WsHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  // Apply intensity to hardware on every change (no-op when not connected)
  useEffect(() => {
    if (role !== "m") return;
    void bt.writeIntensity(intensity);
  }, [intensity, role]);

  // S side: explicit offline. M side: BT was already paired in BtGate,
  // so we do NOT re-trigger the chooser here. If M skipped via demo mode,
  // status is already "offline".
  useEffect(() => {
    if (role === "s") bt.goOffline();
  }, [role]);

  // M side: watch for mid-session BT interruption (GATT disconnected after
  // being connected). Show pause overlay until user reconnects or exits.
  // Also announce every status change to the server so S can display the
  // peer's hardware state instead of its own (offline) state.
  useEffect(() => {
    if (role !== "m") return;
    let prev: BtStatus = bt.getStatus();
    const unsub = bt.subscribe((next) => {
      if (!demoMode) {
        if (prev === "connected" && next !== "connected") {
          setBtInterrupted(true);
        }
        if (next === "connected" && prev !== "connected") {
          setBtInterrupted(false);
          setBtReconnecting(false);
          void bt.writeIntensity(intensityRef.current);
        }
      }
      if (wsRef.current?.isOpen()) {
        wsRef.current.send({ type: "bt_status", status: next });
      }
      prev = next;
    });
    return unsub;
  }, [role, demoMode]);

  async function handleBtReconnect() {
    setBtReconnecting(true);
    const result = await bt.connect();
    if (result !== "connected") {
      setBtReconnecting(false);
    }
  }

  // WebSocket lifecycle
  useEffect(() => {
    if (!role || !code) return;

    const handle = connect({
      code,
      role,
      safeWord: role === "m" ? safeWord : undefined,
      onStatus: (status) => {
        if (status === "connecting") setConnection("waiting");
      },
      onMessage: (msg) => handleServerMessage(msg),
    });
    wsRef.current = handle;

    return () => {
      handle.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleServerMessage(msg: ServerMsg) {
    switch (msg.type) {
      case "room_ready":
        setConnection("ready");
        if (msg.safeWord && !safeWord) setSafeWord(msg.safeWord);
        // M announces its current BT status on join so S's badge is accurate
        if (role === "m" && wsRef.current?.isOpen()) {
          wsRef.current.send({ type: "bt_status", status: bt.getStatus() });
        }
        return;
      case "peer_bt_status":
        setPeerBtStatus(msg.status);
        return;
      case "room_waiting":
        setConnection("waiting");
        return;
      case "chat":
        appendMessage({
          id: `${msg.from}-${msg.seq_id}-${msg.timestamp}`,
          from: msg.from,
          text: msg.text,
          intensity: msg.intensity,
          reason: msg.reason,
          seq_id: msg.seq_id,
          timestamp: msg.timestamp,
        });
        return;
      case "safe_word_triggered":
        setTerminatedBanner({ visible: true, reason: "safe_word" });
        terminate();
        void bt.writeIntensity(0);
        void bt.disconnect();
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        return;
      case "peer_left":
        setTerminatedBanner({ visible: true, reason: "peer_left" });
        terminate();
        void bt.writeIntensity(0);
        void bt.disconnect();
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        return;
      case "error":
        setConnection("disconnected");
        setTerminatedBanner({ visible: true, reason: "peer_left" });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        return;
      case "pong":
        return;
    }
  }

  // Autoscroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  function send() {
    const text = input.trim();
    if (!text) return;
    if (!wsRef.current?.isOpen()) return;
    wsRef.current.send({ type: "chat", text });
    setInput("");
  }

  async function handleLeave() {
    wsRef.current?.leave();
    try {
      await bt.writeIntensity(0);
    } catch {
      // ignore
    }
    await bt.disconnect();
    // Hard reload: Chrome's internal BT pipeline accumulates state across
    // repeated requestDevice/connect/disconnect/forget cycles and after a
    // handful of rounds requestDevice() starts failing or timing out.
    // Reloading destroys the page's BT context so the next session gets a
    // fresh one — equivalent to the manual F5 workaround.
    window.location.reload();
  }

  const statusText = useMemo(() => {
    if (connection === "waiting") return "等待对方加入…";
    if (connection === "ready") return "已连接";
    if (connection === "disconnected") return "已断开";
    if (connection === "terminated") return "已终止";
    return "连接中…";
  }, [connection]);

  return (
    <div className="min-h-full flex flex-col md:flex-row bg-haze text-ink-900">
      {/* Header */}
      <div className="md:hidden px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between border-b border-ink-300/60">
        <div className="flex gap-4 text-xs">
          <div>
            <div className="text-ink-500">房间</div>
            <div className="font-mono text-ink-900">{code}</div>
          </div>
          <div>
            <div className="text-ink-500">安全词</div>
            <div className="font-mono text-ink-900">{safeWord || "—"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {role === "m" ? (
            <BluetoothStatus />
          ) : (
            <BluetoothStatus status={peerBtStatus} peer />
          )}
          <button
            onClick={handleLeave}
            className="text-xs text-danger px-3 py-1.5 rounded-pill border border-danger/40 active:bg-danger/10"
          >
            退出
          </button>
        </div>
      </div>

      <div className="md:hidden flex items-center justify-center py-4 border-b border-ink-300/60 bg-white/30 backdrop-blur-sm">
        <IntensityViz intensity={intensity} compact />
      </div>

      {/* Chat column */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-ink-300/60">
          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="text-ink-500 mr-2">安全词</span>
              <span className="font-mono">{safeWord || "—"}</span>
            </div>
            <div className="text-sm">
              <span className="text-ink-500 mr-2">房间</span>
              <span className="font-mono">{code}</span>
            </div>
            <div className="text-sm">
              <span className="text-ink-500 mr-2">你是</span>
              <span className="uppercase font-semibold">{role}</span>
            </div>
            <div className="text-sm text-ink-500">{statusText}</div>
          </div>
          <div className="flex items-center gap-3">
            {role === "m" ? (
            <BluetoothStatus />
          ) : (
            <BluetoothStatus status={peerBtStatus} peer />
          )}
            <button
              onClick={handleLeave}
              className="text-xs text-danger px-3 py-1.5 rounded-pill border border-danger/40 hover:bg-danger/10"
            >
              退出
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3"
        >
          {messages.length === 0 && connection === "waiting" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="text-xs text-ink-500">把下面的房间号发给对方</div>
              <div className="font-mono text-3xl tracking-[0.3em] bg-attrax-grad bg-clip-text text-transparent">
                {code}
              </div>
              <div className="text-sm text-ink-500">等待对方加入…</div>
              {safeWord && (
                <div className="text-xs text-ink-500">
                  当前安全词：
                  <span className="font-mono text-ink-900 ml-1">
                    {safeWord}
                  </span>
                </div>
              )}
            </div>
          )}
          {messages.length === 0 && connection === "ready" && (
            <div className="text-center text-ink-500 text-sm py-8">
              开始聊天吧。S 的消息会驱动档位变化。
            </div>
          )}
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} self={role!} />
          ))}
        </div>

        <div className="px-4 md:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-ink-300/60 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            disabled={connection !== "ready" || btInterrupted}
            placeholder={
              btInterrupted
                ? "硬件已断开,请重连"
                : connection === "ready"
                ? "输入消息…"
                : "等待连接…"
            }
            className="flex-1 min-w-0 bg-stage text-white placeholder:text-ink-500 border border-ink-700 rounded-pill px-5 py-3 focus:border-accent-500 outline-none disabled:opacity-40"
            maxLength={200}
          />
          <button
            onClick={send}
            disabled={connection !== "ready" || !input.trim() || btInterrupted}
            className="px-6 rounded-pill bg-accent-500 hover:bg-accent-600 text-white font-medium disabled:opacity-40"
          >
            发送
          </button>
        </div>
      </div>

      {/* Desktop viz panel */}
      <div className="hidden md:flex w-80 border-l border-ink-300/60 bg-white/30 backdrop-blur-sm items-center justify-center">
        <IntensityViz intensity={intensity} />
      </div>

      {/* BT interrupted overlay (M side only, non-demo) */}
      {btInterrupted && !terminatedBanner.visible && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-40 p-6">
          <div className="bg-attrax-panel border border-attrax-danger/50 rounded-card p-8 max-w-sm w-full text-center space-y-4 text-attrax-text">
            <div className="text-2xl">蓝牙已断开</div>
            <div className="text-sm text-attrax-muted">
              硬件跳蛋的连接丢失。聊天已暂停。
              <br />
              请重新连接硬件或退出会话。
            </div>
            <button
              onClick={handleBtReconnect}
              disabled={btReconnecting}
              className="w-full py-3 rounded-pill bg-accent-500 hover:bg-accent-600 text-white font-medium disabled:opacity-50"
            >
              {btReconnecting ? "连接中…" : "重新连接硬件"}
            </button>
            <button
              onClick={handleLeave}
              className="w-full py-2 text-sm text-danger border border-danger/40 rounded-pill hover:bg-danger/10"
            >
              退出会话
            </button>
          </div>
        </div>
      )}

      {/* Terminated overlay */}
      {terminatedBanner.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-attrax-panel border border-white/10 rounded-card p-8 max-w-sm text-center text-attrax-text">
            <div className="text-2xl mb-2">
              {terminatedBanner.reason === "safe_word"
                ? "会话已安全终止"
                : "对方已离开"}
            </div>
            <div className="text-sm text-attrax-muted">
              2 秒后返回登入页…
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
