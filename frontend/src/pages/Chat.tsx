import { useEffect, useMemo, useRef, useState } from "react";
import type { Intensity, ServerMsg } from "@attrax/shared";
import { BluetoothStatus } from "../components/BluetoothStatus.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { IntensityViz } from "../components/IntensityViz.js";
import * as bt from "../lib/bluetooth.js";
import type { BtStatus } from "../lib/bluetooth.js";
import { connect, type WsHandle } from "../lib/ws.js";
import { useStore } from "../store.js";

const INTENSITY_BG: Record<Intensity, string> = {
  0: "radial-gradient(ellipse 90% 60% at 50% 25%, #eef0f4 0%, #f6f7fa 60%, #ffffff 100%)",
  1: "radial-gradient(ellipse 100% 60% at 50% 25%, #c4e2ec 0%, #dde9ee 45%, #f4f6f6 100%)",
  2: "radial-gradient(ellipse 100% 60% at 50% 25%, #ffd3b4 0%, #ffe4d0 45%, #fff5ec 100%)",
  3: "radial-gradient(ellipse 100% 60% at 50% 25%, #ff9c7e 0%, #ffc2ad 45%, #ffe1d4 100%)",
};

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
    resetSession,
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

  useEffect(() => {
    if (role !== "m") return;
    void bt.writeIntensity(intensity);
  }, [intensity, role]);

  useEffect(() => {
    if (role === "s") bt.goOffline();
  }, [role]);

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
    if (result !== "connected") setBtReconnecting(false);
  }

  useEffect(() => {
    if (!role || !code) return;
    const handle = connect({
      code,
      role,
      safeWord: role === "m" ? safeWord : safeWord || undefined,
      onStatus: (status) => {
        if (status === "connecting") setConnection("waiting");
      },
      onMessage: (msg) => handleServerMessage(msg),
    });
    wsRef.current = handle;
    return () => handle.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleServerMessage(msg: ServerMsg) {
    switch (msg.type) {
      case "room_ready":
        setConnection("ready");
        if (msg.safeWord && !safeWord) setSafeWord(msg.safeWord);
        if (role === "m" && wsRef.current?.isOpen()) {
          wsRef.current.send({ type: "bt_status", status: bt.getStatus() });
        }
        return;
      case "room_waiting":
        setConnection("waiting");
        return;
      case "peer_bt_status":
        setPeerBtStatus(msg.status);
        return;
      case "chat":
        appendMessage({
          id: `${msg.from}-${msg.seq_id}-${msg.timestamp}`,
          from: msg.from,
          text: msg.text,
          intensity: msg.intensity,
          intent_code: msg.intent_code,
          seq_id: msg.seq_id,
          timestamp: msg.timestamp,
        });
        return;
      case "safe_word_triggered":
        setTerminatedBanner({ visible: true, reason: "safe_word" });
        terminate();
        void bt.writeIntensity(0);
        void bt.disconnect();
        setTimeout(() => resetSession(), 2000);
        return;
      case "peer_left":
        setTerminatedBanner({ visible: true, reason: "peer_left" });
        terminate();
        void bt.writeIntensity(0);
        void bt.disconnect();
        setTimeout(() => resetSession(), 2000);
        return;
      case "error":
        setConnection("disconnected");
        setTerminatedBanner({ visible: true, reason: "peer_left" });
        setTimeout(() => resetSession(), 2000);
        return;
      case "pong":
        return;
    }
  }

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

  function handleLeave() {
    wsRef.current?.leave();
    resetSession();
  }

  const statusText = useMemo(() => {
    if (connection === "waiting") return "等待对方加入…";
    if (connection === "ready") return "已连接";
    if (connection === "disconnected") return "已断开";
    if (connection === "terminated") return "已终止";
    return "连接中…";
  }, [connection]);

  const sendDisabled =
    connection !== "ready" || !input.trim() || btInterrupted;

  return (
    <div
      className="min-h-full flex flex-col md:flex-row relative text-attrax-chat-text"
      style={{ background: INTENSITY_BG[intensity], transition: "background 700ms ease" }}
    >
      {/* ── Mobile header ── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3">
        <button
          onClick={handleLeave}
          className="w-9 h-9 rounded-full bg-attrax-black text-white flex items-center justify-center text-lg"
          aria-label="退出"
        >
          ×
        </button>
        <div className="inline-flex items-center gap-2 rounded-pill bg-attrax-bubble border border-attrax-bubble-border px-4 py-1.5 shadow-sm">
          <span className="text-[11px] text-attrax-chat-muted">安全词</span>
          <span className="text-sm font-medium">{safeWord || "—"}</span>
        </div>
        {role === "m" ? (
          <BluetoothStatus />
        ) : (
          <BluetoothStatus status={peerBtStatus} peer />
        )}
      </div>

      {/* ── Mobile top dial ── */}
      <div className="md:hidden flex flex-col items-center py-2">
        <IntensityViz intensity={intensity} compact />
      </div>

      {/* ── Chat column ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLeave}
              className="w-9 h-9 rounded-full bg-attrax-black text-white flex items-center justify-center"
              aria-label="退出"
            >
              ×
            </button>
            <div className="inline-flex items-center gap-2 rounded-pill bg-attrax-bubble border border-attrax-bubble-border px-4 py-1.5 shadow-sm">
              <span className="text-[11px] text-attrax-chat-muted">安全词</span>
              <span className="text-sm font-medium">{safeWord || "—"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-attrax-chat-muted">
            <span>
              房间 <span className="font-mono text-attrax-chat-text">{code}</span>
            </span>
            <span>·</span>
            <span>
              你是 <span className="uppercase text-attrax-chat-text font-semibold">{role}</span>
            </span>
            <span>·</span>
            <span>{statusText}</span>
            {role === "m" ? (
              <BluetoothStatus />
            ) : (
              <BluetoothStatus status={peerBtStatus} peer />
            )}
          </div>
        </div>

        {/* Message list */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-3"
        >
          {messages.length === 0 && connection === "waiting" && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="text-xs text-attrax-chat-muted tracking-wider">
                把下面的房间号发给对方
              </div>
              <div className="font-mono text-4xl tracking-[0.3em] text-attrax-chat-text">
                {code}
              </div>
              <div className="text-sm text-attrax-chat-muted">等待对方加入…</div>
            </div>
          )}
          {messages.length === 0 && connection === "ready" && (
            <div className="text-center text-attrax-chat-muted text-sm py-10">
              开始聊天吧。S 的消息会驱动档位变化。
            </div>
          )}
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} self={role!} />
          ))}
        </div>

        {/* Input bar */}
        <div className="px-4 md:px-8 py-4 flex items-center gap-3">
          <div
            className={`flex-1 rounded-pill bg-attrax-black flex items-center px-5 py-3 transition ${
              sendDisabled && !input ? "opacity-80" : ""
            }`}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={connection !== "ready" || btInterrupted}
              placeholder={
                btInterrupted
                  ? "硬件已断开,请重连"
                  : connection === "ready"
                  ? "输入消息…"
                  : "等待连接…"
              }
              className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
              maxLength={200}
            />
          </div>
          <button
            onClick={send}
            disabled={sendDisabled}
            className="w-12 h-12 rounded-full bg-attrax-accent text-white flex items-center justify-center text-xl disabled:opacity-30 hover:bg-attrax-accent-dark transition shadow-md shadow-attrax-accent/30"
            aria-label="发送"
          >
            ↑
          </button>
        </div>
      </div>

      {/* ── Desktop right panel ── */}
      <div className="hidden md:flex w-80 items-center justify-center">
        <IntensityViz intensity={intensity} />
      </div>

      {/* BT interrupted overlay */}
      {btInterrupted && !terminatedBanner.visible && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-6">
          <div className="bg-white text-attrax-chat-text border border-attrax-danger/30 rounded-card p-8 max-w-sm w-full text-center space-y-5 shadow-2xl">
            <div className="text-xl font-semibold">蓝牙已断开</div>
            <div className="text-sm text-attrax-chat-muted">
              硬件跳蛋的连接丢失。聊天已暂停。
              <br />
              请重新连接硬件或退出会话。
            </div>
            <button
              onClick={handleBtReconnect}
              disabled={btReconnecting}
              className="w-full py-3 rounded-pill bg-attrax-accent text-white font-medium disabled:opacity-50 hover:bg-attrax-accent-dark"
            >
              {btReconnecting ? "连接中…" : "重新连接硬件"}
            </button>
            <button
              onClick={handleLeave}
              className="w-full py-2 text-sm text-attrax-danger border border-attrax-danger/40 rounded-pill hover:bg-attrax-danger/10"
            >
              退出会话
            </button>
          </div>
        </div>
      )}

      {/* Terminated overlay */}
      {terminatedBanner.visible && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white text-attrax-chat-text rounded-card p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-xl font-semibold mb-2">
              {terminatedBanner.reason === "safe_word"
                ? "会话已安全终止"
                : "对方已离开"}
            </div>
            <div className="text-sm text-attrax-chat-muted">
              2 秒后返回登入页…
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
