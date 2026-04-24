import { useEffect, useMemo, useRef, useState } from "react";
import type { ServerMsg } from "@attrax/shared";
import { BluetoothStatus } from "../components/BluetoothStatus.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { IntensityViz } from "../components/IntensityViz.js";
import * as bt from "../lib/bluetooth.js";
import type { BtStatus } from "../lib/bluetooth.js";
import * as rtc from "../lib/webrtc.js";
import * as chunkedStt from "../lib/chunked-stt.js";
import { connect, type WsHandle } from "../lib/ws.js";
import { useStore } from "../store.js";

// Preset quick-send chips above the input. Tap → sends immediately.
const PRESET_MESSAGES = [
  "想我吗",
  "过来抱抱，乖乖睡觉",
  "你要看着我，不许想别的",
  "看来今天得稍微罚一下你长长记性",
  "这是给你的最高奖励",
];

// Ringing timeouts — caller gives up after 30s of no answer, callee
// auto-rejects after 45s in case the caller is hung / offline.
const CALL_INVITE_TIMEOUT_MS = 30_000;
const CALL_RING_TIMEOUT_MS = 45_000;

export function Chat() {
  const {
    role,
    code,
    safeWord,
    messages,
    intensity,
    demoMode,
    connection,
    callState,
    setConnection,
    setCallState,
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
  const [muted, setMuted] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  // Live interim transcript from Web Speech API — shown as a thin "🎙️ …"
  // line under the header so users get immediate feedback that their voice
  // is being heard, before the final transcript commits to a chat bubble.
  const [sttInterim, setSttInterim] = useState("");

  const wsRef = useRef<WsHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sttRef = useRef<chunkedStt.ChunkedSttHandle | null>(null);
  const outgoingRingTimerRef = useRef<number | null>(null);
  const incomingRingTimerRef = useRef<number | null>(null);
  // Latest-callback ref for the WS message handler. The ws useEffect runs
  // once at mount with `[]` deps, which freezes the closure it registers.
  // Without this indirection, `handleServerMessage` would read `callState`
  // from render 1 (always "idle"), causing `peer_call_accept` to early-return
  // on the caller side — no SDP ever gets created.
  const handleServerMessageRef = useRef<(msg: ServerMsg) => void>(() => {});

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
    console.log("[call] remote stream arrived, tracks:", stream.getTracks().map((t) => `${t.kind}:${t.readyState}`));
    if (!audioRef.current) {
      console.warn("[call] audioRef not yet mounted — remote stream dropped");
      return;
    }
    audioRef.current.srcObject = stream;
    void audioRef.current.play().catch((err) => {
      console.warn("[call] audio.play() blocked, peer will be silent until user gesture:", err);
    });
  }

  function startLocalStt(): void {
    if (role !== "s") {
      console.log("[call] startLocalStt skipped, role=", role);
      return;
    }
    if (sttRef.current) return;
    const localStream = rtc.getLocalStream();
    if (!localStream) {
      console.warn("[call] no local stream — STT cannot start");
      setSttError("本地麦克风未就绪");
      return;
    }
    const handle = chunkedStt.startChunkedStt({
      stream: localStream,
      chunkMs: 2500,
      onText: (text) => {
        console.log("[call] stt → chat:", text);
        if (!wsRef.current?.isOpen()) return;
        wsRef.current.send({ type: "chat", text });
      },
      onListening: (active) => {
        setSttInterim(active ? "识别中…" : "监听中");
      },
      onError: (err) => {
        console.warn("[call] stt error:", err);
        setSttError(err);
      },
    });
    sttRef.current = handle;
    setSttInterim("监听中");
    console.log("[call] chunked STT started");
  }

  function stopLocalStt(): void {
    sttRef.current?.stop();
    sttRef.current = null;
    setSttInterim("");
  }

  function clearOutgoingRingTimer(): void {
    if (outgoingRingTimerRef.current !== null) {
      window.clearTimeout(outgoingRingTimerRef.current);
      outgoingRingTimerRef.current = null;
    }
  }

  function clearIncomingRingTimer(): void {
    if (incomingRingTimerRef.current !== null) {
      window.clearTimeout(incomingRingTimerRef.current);
      incomingRingTimerRef.current = null;
    }
  }

  function cleanupCall(): void {
    clearOutgoingRingTimer();
    clearIncomingRingTimer();
    stopLocalStt();
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setCallState("idle");
    setMuted(false);
  }

  // Caller presses 📞 — send the ringing invite only. Mic is NOT opened yet;
  // WebRTC negotiation is deferred until we see `peer_call_accept`.
  function handleStartCall(): void {
    if (!role) return;
    if (callState !== "idle") return;
    if (!wsRef.current?.isOpen()) return;
    wsRef.current.send({ type: "call_invite" });
    setCallState("calling");
    clearOutgoingRingTimer();
    outgoingRingTimerRef.current = window.setTimeout(() => {
      // No answer in 30s — tell peer and reset.
      if (wsRef.current?.isOpen()) {
        wsRef.current.send({ type: "call_timeout" });
      }
      setCallState("idle");
      outgoingRingTimerRef.current = null;
    }, CALL_INVITE_TIMEOUT_MS);
  }

  // Callee presses 接听 — open mic, spin up the non-initiator peer so it's
  // ready to consume the incoming offer, then signal accept. The caller will
  // only create its offer after seeing peer_call_accept (see server-message
  // handler below).
  async function handleAcceptCall(): Promise<void> {
    if (callState !== "ringing") return;
    clearIncomingRingTimer();
    try {
      await rtc.startCall({
        asInitiator: false,
        sendSignal: (m) => wsRef.current?.send(m),
        onRemoteStream: attachRemoteStream,
        onEnd: () => cleanupCall(),
      });
    } catch (err) {
      console.error("[call] accept: rtc.startCall failed", err);
      setCallState("idle");
      setSttError("无法访问麦克风");
      wsRef.current?.send({ type: "call_reject" });
      return;
    }
    // Peer is ready — tell caller to start its offer.
    wsRef.current?.send({ type: "call_accept" });
    setCallState("in_call");
    // Voice-driven intensity: only S's speech feeds the pipeline. M's mic
    // still flows through WebRTC so S can hear them.
    startLocalStt();
  }

  function handleRejectCall(): void {
    if (callState !== "ringing") return;
    clearIncomingRingTimer();
    wsRef.current?.send({ type: "call_reject" });
    setCallState("idle");
  }

  function handleCancelCall(): void {
    if (callState !== "calling") return;
    clearOutgoingRingTimer();
    wsRef.current?.send({ type: "call_cancel" });
    setCallState("idle");
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

  // Keep the ref pointing at the newest handler every render so the WS
  // callback always sees fresh state.
  handleServerMessageRef.current = handleServerMessage;

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
      onMessage: (msg) => handleServerMessageRef.current(msg),
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
      case "peer_call_invite":
        // Peer is ringing us. If we're already busy, auto-reject so the
        // caller doesn't wait. Otherwise enter ringing state and arm the
        // auto-reject timer.
        if (callState !== "idle") {
          wsRef.current?.send({ type: "call_reject" });
          return;
        }
        setCallState("ringing");
        clearIncomingRingTimer();
        incomingRingTimerRef.current = window.setTimeout(() => {
          if (wsRef.current?.isOpen()) {
            wsRef.current.send({ type: "call_reject" });
          }
          setCallState("idle");
          incomingRingTimerRef.current = null;
        }, CALL_RING_TIMEOUT_MS);
        return;
      case "peer_call_accept":
        // Callee picked up — now (and only now) do we open the mic and
        // create the initiator peer. simple-peer fires "signal" with the
        // offer once ready; webrtc.ts relays it as rtc_offer.
        if (callState !== "calling") return;
        clearOutgoingRingTimer();
        void (async () => {
          try {
            await rtc.startCall({
              asInitiator: true,
              sendSignal: (m) => wsRef.current?.send(m),
              onRemoteStream: attachRemoteStream,
              onEnd: () => cleanupCall(),
            });
          } catch (err) {
            console.error("[call] caller: rtc.startCall failed", err);
            setCallState("idle");
            setSttError("无法访问麦克风");
            rtc.hangup(true, (m) => wsRef.current?.send(m));
            return;
          }
          setCallState("in_call");
          startLocalStt();
        })();
        return;
      case "peer_call_reject":
      case "peer_call_cancel":
      case "peer_call_timeout":
        // Ringing ended without a call. Tear down any partial state.
        clearOutgoingRingTimer();
        clearIncomingRingTimer();
        setCallState("idle");
        return;
      case "peer_rtc_offer":
      case "peer_rtc_answer":
      case "peer_rtc_ice":
        // By this point both sides have accepted and spun up their peer.
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

  function sendPreset(text: string) {
    if (connection !== "ready" || btInterrupted) return;
    if (!wsRef.current?.isOpen()) return;
    wsRef.current.send({ type: "chat", text });
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
    // Viewport lock: h-dvh + overflow-hidden → only the middle messages area
    // scrolls; header / chips / input stay pinned. Works on both mobile
    // (dynamic vh handles iOS address-bar) and desktop.
    <div className="h-dvh overflow-hidden bg-haze text-ink-900 flex flex-col md:flex-row">

      {/* ── Chat column (full-width mobile, left-pane desktop) ───────────── */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">

        {/* Header — single unified design for both breakpoints */}
        <div className="shrink-0 bg-haze/80 backdrop-blur-md border-b border-white/40 px-4 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Leave — black round X per reference */}
            <button
              onClick={handleLeave}
              className="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full bg-ink-900 text-white flex items-center justify-center text-sm active:bg-ink-700 md:hover:bg-ink-700"
              aria-label="退出"
            >
              ✕
            </button>
            {/* Safe word pill — always visible, truncate on overflow */}
            <div className="flex-1 min-w-0 bg-white rounded-pill shadow-bubble px-4 md:px-5 py-2 md:py-2.5 flex items-center gap-2">
              <span className="text-[11px] md:text-xs text-ink-500 shrink-0">安全词</span>
              <span className="flex-1 text-sm md:text-base font-mono text-ink-900 truncate">
                {safeWord || "—"}
              </span>
              <svg
                className="w-3.5 h-3.5 md:w-4 md:h-4 text-ink-500 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            {/* Right cluster — Call + BT status */}
            <div className="shrink-0 flex items-center gap-1 md:gap-2">
              <CallControl
                role={role}
                callState={callState}
                muted={muted}
                canCall={connection === "ready"}
                onStart={handleStartCall}
                onCancel={handleCancelCall}
                onHangup={handleHangup}
                onToggleMute={handleToggleMute}
              />
              {role === "m" ? (
                <BluetoothStatus />
              ) : (
                <BluetoothStatus status={peerBtStatus} peer />
              )}
            </div>
          </div>
          {/* Secondary info line */}
          <div className="mt-2 flex items-center justify-between px-1 text-[11px] md:text-xs text-ink-500">
            <span>
              房间 <span className="font-mono text-ink-900 ml-1">{code}</span>
              <span className="ml-3">你是 <span className="uppercase font-semibold text-ink-900">{role}</span></span>
            </span>
            <span>{statusText}</span>
          </div>
        </div>

        {/* Live STT preview — S only, while in a call. Confirms the mic is
            being heard before the final transcript commits to a chat bubble
            and drives the intensity pipeline. */}
        {role === "s" && callState === "in_call" && sttInterim && (
          <div className="shrink-0 px-4 md:px-6 py-1.5 bg-ink-900/80 text-white/90 text-xs md:text-sm flex items-center gap-2">
            <span className="shrink-0">🎙️</span>
            <span className="flex-1 truncate italic opacity-90">
              {sttInterim}
            </span>
          </div>
        )}

        {/* Ringing banner — visible only during calling/ringing. Sits below
            the header but above the intensity bar so it doesn't obscure
            chat scroll. Accept/reject live here (callee) and cancel here
            too on narrow screens where the header control is cramped. */}
        {callState === "calling" && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 py-2.5 bg-accent-500/10 border-b border-accent-500/20">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
              </span>
              <span className="text-xs md:text-sm text-ink-900 truncate">
                正在呼叫对方…
              </span>
            </div>
            <button
              onClick={handleCancelCall}
              className="shrink-0 text-xs md:text-sm px-3 py-1.5 rounded-pill bg-danger text-white"
            >
              取消
            </button>
          </div>
        )}
        {callState === "ringing" && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 py-2.5 bg-accent-500/20 border-b border-accent-500/40">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">📞</span>
              <span className="text-xs md:text-sm text-ink-900 truncate">
                对方请求通话
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleRejectCall}
                className="text-xs md:text-sm px-3 py-1.5 rounded-pill bg-white text-ink-900 border border-ink-300"
              >
                拒接
              </button>
              <button
                onClick={() => void handleAcceptCall()}
                className="text-xs md:text-sm px-3 py-1.5 rounded-pill bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                接听
              </button>
            </div>
          </div>
        )}

        {/* Compact intensity bar — mobile only (desktop has the side panel) */}
        <div className="md:hidden shrink-0 flex items-center justify-center py-3 border-b border-white/40 bg-white/30 backdrop-blur-sm">
          <IntensityViz intensity={intensity} compact />
        </div>

        {/* Scrolling message area — the ONLY thing that scrolls */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-4 md:py-6 space-y-3"
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

        {/* Preset quick-send chips — tap sends immediately */}
        <div className="shrink-0 px-4 md:px-6 pt-2 bg-haze/70 backdrop-blur-sm border-t border-white/40">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PRESET_MESSAGES.map((text) => (
              <button
                key={text}
                onClick={() => sendPreset(text)}
                disabled={connection !== "ready" || btInterrupted}
                className="shrink-0 px-3.5 py-1.5 rounded-pill bg-white/90 text-ink-900 text-xs md:text-sm border border-ink-300/60 shadow-bubble active:bg-white md:hover:bg-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {/* Input dock — black pill input + orange circle send */}
        <div className="shrink-0 px-4 md:px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2 md:gap-3 bg-haze/70 backdrop-blur-sm">
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
            className="flex-1 min-w-0 bg-ink-900 text-white placeholder:text-ink-500 rounded-pill px-5 py-3 md:py-3.5 outline-none focus:ring-2 focus:ring-accent-500/60 disabled:opacity-40"
            maxLength={200}
          />
          <button
            onClick={send}
            disabled={connection !== "ready" || !input.trim() || btInterrupted}
            className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full bg-accent-500 hover:bg-accent-600 text-white flex items-center justify-center shadow-bubble disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="发送"
          >
            <svg
              className="w-5 h-5 md:w-6 md:h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Desktop viz side panel (landscape only) ───────────────────────── */}
      <div className="hidden md:flex md:w-96 lg:w-[28rem] shrink-0 border-l border-white/40 bg-white/40 backdrop-blur-md flex-col items-center justify-center p-8 gap-6">
        <div className="text-xs uppercase tracking-[0.3em] text-ink-500">
          intensity
        </div>
        <IntensityViz intensity={intensity} />
        <div className="text-xs text-ink-500 text-center leading-relaxed max-w-[20ch]">
          {role === "s"
            ? "你的消息会驱动 M 侧硬件的档位变化"
            : "对方消息会驱动你的硬件档位"}
        </div>
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

      {/* Floating emergency stop — positioned below the sticky 2-row header */}
      {!terminatedBanner.visible && (
        <button
          onClick={handleEmergencyStop}
          className="fixed right-4 md:right-6 z-30 top-[calc(env(safe-area-inset-top)+5.5rem)] md:top-24 rounded-pill bg-danger text-white font-semibold px-4 py-2.5 text-sm shadow-lg active:bg-danger/80"
          aria-label="紧急停止"
        >
          ⛔ 紧急停止
        </button>
      )}

      {/* STT error banner (dismissable) — float above the header */}
      {sttError && (
        <div className="fixed left-1/2 bottom-28 -translate-x-1/2 z-40 bg-ink-800 text-white text-xs px-3 py-2 rounded-pill border border-danger/40 shadow">
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
  callState: "idle" | "calling" | "ringing" | "in_call";
  muted: boolean;
  canCall: boolean;
  onStart: () => void;
  onCancel: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
}

function CallControl({
  role,
  callState,
  muted,
  canCall,
  onStart,
  onCancel,
  onHangup,
  onToggleMute,
}: CallControlProps) {
  if (callState === "in_call") {
    return (
      <div className="inline-flex items-center gap-1">
        <button
          onClick={onToggleMute}
          className={`text-xs px-3 py-1.5 rounded-pill border ${
            muted
              ? "bg-ink-700 border-ink-700 text-white"
              : "bg-white/80 border-ink-300/60 text-ink-900"
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
  if (callState === "calling") {
    return (
      <button
        onClick={onCancel}
        className="text-xs px-3 py-1.5 rounded-pill bg-danger text-white"
        aria-label="取消呼叫"
      >
        取消
      </button>
    );
  }
  if (callState === "ringing") {
    // Primary action (接听/拒接) lives in the banner; header slot stays quiet
    // so we don't duplicate the affordance.
    return null;
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
