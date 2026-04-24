import { useEffect, useMemo, useRef, useState } from "react";
import type { ServerMsg } from "@attrax/shared";
import { BluetoothStatus } from "../components/BluetoothStatus.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { IntensityViz } from "../components/IntensityViz.js";
import * as bt from "../lib/bluetooth.js";
import type { BtStatus } from "../lib/bluetooth.js";
import * as rtc from "../lib/webrtc.js";
import * as stt from "../lib/stt.js";
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
    reason: "safe_word" | "peer_left" | "error" | null;
    errorCode?: string;
    errorMessage?: string;
  }>({ visible: false, reason: null });
  const [btInterrupted, setBtInterrupted] = useState(false);
  const [btReconnecting, setBtReconnecting] = useState(false);
  const [peerBtStatus, setPeerBtStatus] = useState<BtStatus | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callStarting, setCallStarting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);

  const wsRef = useRef<WsHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sttRef = useRef<stt.SttHandle | null>(null);

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

  // ── Voice call + STT ──────────────────────────────────────────────────────
  function attachRemoteStream(stream: MediaStream): void {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      void audioRef.current.play().catch(() => {
        // Autoplay may be blocked on some browsers; user click on call
        // button already counts as a gesture so this rarely fails.
      });
    }
  }

  function startLocalStt(): void {
    if (role !== "s") return; // only S transcribes to drive pipeline
    if (!stt.isSupported()) {
      setSttError("浏览器不支持语音识别（iOS Safari 需装 Bluefy 或走 Whisper）");
      return;
    }
    if (sttRef.current) return;
    try {
      const s = stt.createSttSession({
        lang: "zh-CN",
        minConfidence: 0.5,
        onFinalResult: (text) => {
          if (!wsRef.current?.isOpen()) return;
          wsRef.current.send({ type: "chat", text });
        },
        onError: (err) => setSttError(err),
      });
      s.start();
      sttRef.current = s;
    } catch {
      setSttError("语音识别启动失败");
    }
  }

  function stopLocalStt(): void {
    sttRef.current?.stop();
    sttRef.current = null;
  }

  function cleanupCall(): void {
    stopLocalStt();
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setInCall(false);
    setCallStarting(false);
    setMuted(false);
  }

  async function handleStartCall() {
    if (!role) return;
    if (inCall || callStarting) return;
    setCallStarting(true);
    try {
      await rtc.startCall({
        asInitiator: true,
        sendSignal: (m) => wsRef.current?.send(m),
        onRemoteStream: attachRemoteStream,
        onEnd: () => {
          cleanupCall();
        },
      });
      setInCall(true);
      setCallStarting(false);
      startLocalStt();
    } catch {
      setCallStarting(false);
      setSttError("无法访问麦克风");
    }
  }

  async function acceptIncomingCall(firstOffer: ServerMsg) {
    if (inCall || callStarting) return;
    setCallStarting(true);
    try {
      await rtc.startCall({
        asInitiator: false,
        sendSignal: (m) => wsRef.current?.send(m),
        onRemoteStream: attachRemoteStream,
        onEnd: () => cleanupCall(),
      });
      // The offer triggered us; feed it in now that peer exists
      rtc.feedRemoteSignal(firstOffer);
      setInCall(true);
      setCallStarting(false);
    } catch {
      setCallStarting(false);
      setSttError("无法访问麦克风");
    }
  }

  function handleHangup(): void {
    rtc.hangup(true, (m) => wsRef.current?.send(m));
    cleanupCall();
  }

  function handleToggleMute(): void {
    const next = !muted;
    rtc.setMuted(next);
    sttRef.current?.setMuted(next);
    setMuted(next);
  }

  function handleEmergencyStop(): void {
    wsRef.current?.send({ type: "emergency_stop" });
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
        // Server-side rejection. Most common:
        //   ROLE_TAKEN     — someone (usually a stale tab) is holding the slot
        //   ROOM_FULL      — both S and M already joined this code
        //   INVALID_CODE   — 6-digit regex failed
        // Surface the code + message so user can understand; do NOT
        // masquerade as "peer left".
        console.warn("[ws] server error:", msg.code, msg.message);
        setConnection("disconnected");
        setTerminatedBanner({
          visible: true,
          reason: "error",
          errorCode: msg.code,
          errorMessage: msg.message,
        });
        setTimeout(() => {
          window.location.reload();
        }, 3000);
        return;
      case "pong":
        return;
      case "peer_rtc_offer":
        // Either side auto-accepts incoming calls (user already consented
        // to the room, both parties symmetric).
        if (!inCall && !callStarting) {
          void acceptIncomingCall(msg);
        } else if (inCall) {
          rtc.feedRemoteSignal(msg);
        }
        return;
      case "peer_rtc_answer":
      case "peer_rtc_ice":
        rtc.feedRemoteSignal(msg);
        return;
      case "peer_rtc_hangup":
        rtc.feedRemoteSignal(msg);
        cleanupCall();
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
    rtc.hangup(false);
    cleanupCall();
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
          <CallControl
            role={role}
            inCall={inCall}
            callStarting={callStarting}
            muted={muted}
            canCall={connection === "ready"}
            onStart={handleStartCall}
            onHangup={handleHangup}
            onToggleMute={handleToggleMute}
          />
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
            <CallControl
              role={role}
              inCall={inCall}
              callStarting={callStarting}
              muted={muted}
              canCall={connection === "ready"}
              onStart={handleStartCall}
              onHangup={handleHangup}
              onToggleMute={handleToggleMute}
            />
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

      {/* Remote audio for the peer's voice (hidden element, autoplay) */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {/* Floating emergency stop — positioned top-right to clear the input
          bar + send button. Stays above the header by using safe-area +
          header height offset. */}
      {!terminatedBanner.visible && (
        <button
          onClick={handleEmergencyStop}
          className="fixed right-4 md:right-6 z-30 top-[calc(env(safe-area-inset-top)+4rem)] md:top-20 rounded-pill bg-danger text-white font-semibold px-4 py-2.5 text-sm shadow-lg active:bg-danger/80"
          aria-label="紧急停止"
        >
          ⛔ 紧急停止
        </button>
      )}

      {/* STT error banner (dismissable) */}
      {sttError && (
        <div className="fixed left-1/2 top-2 -translate-x-1/2 z-30 bg-ink-800 text-white text-xs px-3 py-2 rounded-pill border border-danger/40 shadow">
          {sttError}
          <button
            onClick={() => setSttError(null)}
            className="ml-3 text-ink-500 hover:text-white"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
      )}

      {/* Terminated overlay */}
      {terminatedBanner.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-attrax-panel border border-white/10 rounded-card p-8 max-w-sm text-center text-attrax-text">
            <div className="text-2xl mb-2">
              {terminatedBanner.reason === "safe_word"
                ? "会话已安全终止"
                : terminatedBanner.reason === "peer_left"
                ? "对方已离开"
                : "连接失败"}
            </div>
            {terminatedBanner.reason === "error" && (
              <div className="text-xs text-attrax-muted mb-2 font-mono">
                {terminatedBanner.errorCode}
                {terminatedBanner.errorMessage
                  ? ` — ${terminatedBanner.errorMessage}`
                  : ""}
              </div>
            )}
            <div className="text-sm text-attrax-muted">
              {terminatedBanner.reason === "error"
                ? "3 秒后返回登入页，可能是上一个会话还没释放，稍后重试…"
                : "2 秒后返回登入页…"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CallControlProps {
  role: "s" | "m" | null;
  inCall: boolean;
  callStarting: boolean;
  muted: boolean;
  canCall: boolean;
  onStart: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
}

function CallControl({
  role,
  inCall,
  callStarting,
  muted,
  canCall,
  onStart,
  onHangup,
  onToggleMute,
}: CallControlProps) {
  if (inCall) {
    return (
      <div className="inline-flex items-center gap-1">
        <button
          onClick={onToggleMute}
          className={`text-xs px-3 py-1.5 rounded-pill border ${
            muted
              ? "bg-ink-700 border-ink-700 text-white"
              : "bg-transparent border-ink-300/60 text-ink-900 md:text-attrax-text"
          }`}
          aria-label={muted ? "取消静音" : "静音"}
        >
          {muted ? "🔇" : "🎙️"}
        </button>
        <button
          onClick={onHangup}
          className="text-xs px-3 py-1.5 rounded-pill bg-danger text-white"
          aria-label="挂断"
        >
          挂断
        </button>
      </div>
    );
  }
  if (callStarting) {
    return (
      <span className="text-xs text-ink-500 px-2">连接中…</span>
    );
  }
  if (role === "s" || role === "m") {
    return (
      <button
        onClick={onStart}
        disabled={!canCall}
        className="text-xs px-3 py-1.5 rounded-pill bg-accent-500 hover:bg-accent-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={canCall ? "发起通话" : "等待对方加入后才能通话"}
        title={canCall ? "发起通话" : "等待对方加入后才能通话"}
      >
        📞 通话
      </button>
    );
  }
  return null;
}
