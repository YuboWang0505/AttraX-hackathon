import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientMsg, ServerMsg } from "@attrax/shared";
import { BluetoothStatus } from "../components/BluetoothStatus.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { CopyCode } from "../components/CopyCode.js";
import { IntensityViz } from "../components/IntensityViz.js";
import { LangToggle } from "../components/LangToggle.js";
import { useT } from "../i18n/index.js";
import type { Lang } from "../i18n/strings.js";
import * as bt from "../lib/bluetooth.js";
import type { BtStatus } from "../lib/bluetooth.js";
import {
  startChunkedStt,
  type ChunkedSttHandle,
} from "../lib/chunked-stt.js";
import {
  feedRemoteSignal,
  hangup as rtcHangup,
  isInCall as rtcIsInCall,
  setMuted as setRtcMuted,
  startCall,
} from "../lib/webrtc.js";
import { connect, type WsHandle } from "../lib/ws.js";
import { useStore } from "../store.js";

// Demo shortcuts — each string deterministically hits the Layer-1 keyword
// table for the labeled intensity level (verified via keyword-table.ts).
// Keeps demo timing tight (<10ms response) and removes network dependency
// for the canonical S_WARM_UP / S_COMMAND_POSTURE / S_REWARD_HIGH cases.
//
// Bilingual: Chinese variants land on Chinese keywords; English variants
// land on the English keyword extensions added to the same table.
function getQuickShortcuts(lang: Lang): { label: string; text: string }[] {
  if (lang === "en") {
    return [
      { label: "L1", text: "good girl, relax" },
      { label: "L2", text: "kneel for me" },
      { label: "L3", text: "you've been amazing, this is your highest reward" },
    ];
  }
  return [
    { label: "1档", text: "乖,放松" },
    { label: "2档", text: "给我跪好" },
    { label: "3档", text: "表现得太棒了,这是给你的最高奖励。" },
  ];
}

const BRAND = "#FF8A3D";

// Dice faces — uniform distribution across 1/2/3, two per level. Each
// face's text deterministically hits the keyword table so the outcome
// is shown instantly after animation ends.
function getDiceFaces(lang: Lang): { label: string; text: string; intensity: 1 | 2 | 3 }[] {
  if (lang === "en") {
    return [
      { label: "⚀", text: "good girl, relax", intensity: 1 },
      { label: "⚁", text: "hug, well done", intensity: 1 },
      { label: "⚂", text: "kneel for me", intensity: 2 },
      { label: "⚃", text: "beg me", intensity: 2 },
      { label: "⚄", text: "cum for me", intensity: 3 },
      { label: "⚅", text: "punish hard", intensity: 3 },
    ];
  }
  return [
    { label: "⚀", text: "乖,放松", intensity: 1 },
    { label: "⚁", text: "抱抱,辛苦了", intensity: 1 },
    { label: "⚂", text: "给我跪好", intensity: 2 },
    { label: "⚃", text: "求我", intensity: 2 },
    { label: "⚄", text: "给我丢", intensity: 3 },
    { label: "⚅", text: "狠狠惩罚", intensity: 3 },
  ];
}

const DICE_ANIM_MS = 1500;
const DICE_CYCLE_MS = 110;

// How long a caller's invite waits before auto-timing out. Matches the
// peer_call_timeout server message budget so both sides give up together.
const RING_TIMEOUT_MS = 30_000;

export function Chat() {
  const {
    role,
    code,
    safeWord,
    messages,
    intensity,
    demoMode,
    isCreator,
    connection,
    callState,
    setConnection,
    setCallState,
    appendMessage,
    setSafeWord,
    terminate,
  } = useStore();
  const language = useStore((s) => s.language);
  const t = useT();
  const QUICK_SHORTCUTS = useMemo(() => getQuickShortcuts(language), [language]);
  const DICE_FACES = useMemo(() => getDiceFaces(language), [language]);

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
  /** Surfaced when peer's WS dropped but the slot is being held in grace. */
  const [peerOffline, setPeerOffline] = useState<{
    visible: boolean;
    expiresAt: number;
  }>({ visible: false, expiresAt: 0 });
  /** Dice animation state. `outcomeIdx` set only on the roller (S) side. */
  const [rolling, setRolling] = useState<{
    active: boolean;
    outcomeIdx: number | null;
  }>({ active: false, outcomeIdx: null });
  /** Voice-call state: mic toggle, STT activity LED, surface error toasts. */
  const [callMuted, setCallMuted] = useState(false);
  const [sttListening, setSttListening] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  /** Seconds elapsed since in_call started — drives the call-screen timer. */
  const [callElapsed, setCallElapsed] = useState(0);

  const wsRef = useRef<WsHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const sttRef = useRef<ChunkedSttHandle | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const callStartedAtRef = useRef<number>(0);

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

  // ---------- Voice call ----------

  const sendClient = useCallback((msg: ClientMsg) => {
    wsRef.current?.send(msg);
  }, []);

  const teardownCall = useCallback(() => {
    if (ringTimerRef.current !== null) {
      window.clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (sttRef.current) {
      sttRef.current.stop();
      sttRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setSttListening(false);
    setCallMuted(false);
    setCallElapsed(0);
  }, []);

  const beginRtcSession = useCallback(
    async (asInitiator: boolean) => {
      await startCall({
        asInitiator,
        sendSignal: sendClient,
        onLocalStream: (s) => {
          // Tee into chunked STT — transcripts go through the existing chat
          // pipeline so voice inherits all safe-word + keyword + LLM behavior.
          if (sttRef.current) sttRef.current.stop();
          sttRef.current = startChunkedStt({
            stream: s,
            onText: (text) => {
              if (!wsRef.current?.isOpen()) return;
              wsRef.current.send({ type: "chat", text });
            },
            onListening: setSttListening,
            onError: (err) => setCallError(err),
          });
        },
        onRemoteStream: (remote) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remote;
            void remoteAudioRef.current.play().catch(() => {
              // Some browsers block autoplay until user gesture; ignore.
            });
          }
        },
        onEnd: () => {
          // Peer hung up or RTC errored. Bring state back to idle.
          teardownCall();
          setCallState("idle");
        },
      });
    },
    [sendClient, teardownCall, setCallState],
  );

  function startOutgoingCall() {
    if (!wsRef.current?.isOpen()) return;
    if (useStore.getState().callState !== "idle") return;
    if (connection !== "ready") return;
    setCallError(null);
    setCallState("calling");
    wsRef.current.send({ type: "call_invite" });
    if (ringTimerRef.current !== null) {
      window.clearTimeout(ringTimerRef.current);
    }
    ringTimerRef.current = window.setTimeout(() => {
      if (useStore.getState().callState !== "calling") return;
      wsRef.current?.send({ type: "call_timeout" });
      setCallState("idle");
      setCallError(t("chat.call.err.no_answer"));
    }, RING_TIMEOUT_MS);
  }

  function cancelOutgoingCall() {
    if (ringTimerRef.current !== null) {
      window.clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    wsRef.current?.send({ type: "call_cancel" });
    setCallState("idle");
  }

  async function acceptIncomingCall() {
    if (useStore.getState().callState !== "ringing") return;
    setCallError(null);
    // Set up our SimplePeer (non-initiator) BEFORE telling the caller we
    // accepted, so we're ready when their SDP offer arrives.
    try {
      await beginRtcSession(false);
    } catch (err) {
      console.warn("[call] accept failed:", err);
      setCallError(t("chat.call.err.mic"));
      setCallState("idle");
      wsRef.current?.send({ type: "call_reject" });
      return;
    }
    callStartedAtRef.current = Date.now();
    setCallElapsed(0);
    setCallState("in_call");
    wsRef.current?.send({ type: "call_accept" });
  }

  function rejectIncomingCall() {
    wsRef.current?.send({ type: "call_reject" });
    setCallState("idle");
  }

  function endCall() {
    // User-initiated hangup. Notify peer, then tear down local.
    if (rtcIsInCall()) rtcHangup(true, sendClient);
    teardownCall();
    setCallState("idle");
  }

  function toggleMute() {
    const next = !callMuted;
    setCallMuted(next);
    setRtcMuted(next);
    sttRef.current?.setMuted(next);
  }

  // Tick the in-call timer once per second.
  useEffect(() => {
    if (callState !== "in_call") return;
    const id = window.setInterval(() => {
      setCallElapsed(
        Math.floor((Date.now() - callStartedAtRef.current) / 1000),
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [callState]);

  // Auto-dismiss the callError toast so it doesn't linger.
  useEffect(() => {
    if (!callError) return;
    const id = window.setTimeout(() => setCallError(null), 4000);
    return () => window.clearTimeout(id);
  }, [callError]);

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
      // Tear down any active call so the mic + RTC peer don't leak on unmount.
      if (rtcIsInCall()) rtcHangup(false);
      teardownCall();
      handle.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleServerMessage(msg: ServerMsg) {
    switch (msg.type) {
      case "room_ready":
        setConnection("ready");
        // useStore.getState() reads the latest store value. The closure
        // version (`safeWord` from destructure) is captured at first
        // render and would mis-read once the user has navigated.
        if (msg.safeWord && !useStore.getState().safeWord) {
          setSafeWord(msg.safeWord);
        }
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
        // Joiner: server has the creator's safe word even though the
        // creator's WS isn't here yet (e.g. they're still on BtGate).
        // Adopt it so the SafetyBanner stops showing "—".
        if (msg.safeWord && !useStore.getState().safeWord) {
          setSafeWord(msg.safeWord);
        }
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
        if (rtcIsInCall()) rtcHangup(false);
        teardownCall();
        setCallState("idle");
        setTerminatedBanner({ visible: true, reason: "safe_word" });
        terminate();
        void bt.writeIntensity(0);
        void bt.disconnect();
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        return;
      case "peer_left":
        if (rtcIsInCall()) rtcHangup(false);
        teardownCall();
        setCallState("idle");
        setPeerOffline({ visible: false, expiresAt: 0 });
        setTerminatedBanner({ visible: true, reason: "peer_left" });
        terminate();
        void bt.writeIntensity(0);
        void bt.disconnect();
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        return;
      case "error":
        // Surface code + message verbatim instead of pretending it's a
        // "peer left" event. Common cases users hit:
        //   ROLE_TAKEN     — same role already present (often a stale tab)
        //   ROOM_FULL      — both slots already taken
        //   INVALID_CODE_* — bad code passed somehow (frontend pre-validates)
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
        }, 3500);
        return;
      case "pong":
        return;
      case "peer_disconnecting":
        setPeerOffline({
          visible: true,
          expiresAt: Date.now() + msg.graceMs,
        });
        return;
      case "peer_reconnected":
        setPeerOffline({ visible: false, expiresAt: 0 });
        // M side specifically: after we (or our peer) come back, the GATT
        // link to the toy is suspect. Probe by writing a 0 — if the
        // characteristic is dead the BluetoothStatus subscription will flip
        // to non-connected and the BT-interrupt overlay opens.
        if (role === "m" && bt.getStatus() === "connected") {
          void bt.writeIntensity(0);
        }
        return;
      case "peer_roll_start":
        // Mirror the same anim on our side. outcomeIdx stays null — we
        // don't know the face yet and don't need to; the selected text
        // arrives as a normal chat message right after animation ends.
        setRolling({ active: true, outcomeIdx: null });
        window.setTimeout(() => {
          setRolling((r) => (r.active ? { active: false, outcomeIdx: null } : r));
        }, DICE_ANIM_MS);
        return;
      case "peer_call_invite":
        if (useStore.getState().callState !== "idle") {
          // Already busy — auto-reject so the caller doesn't hang.
          wsRef.current?.send({ type: "call_reject" });
          return;
        }
        setCallError(null);
        setCallState("ringing");
        return;
      case "peer_call_accept":
        if (useStore.getState().callState !== "calling") return;
        if (ringTimerRef.current !== null) {
          window.clearTimeout(ringTimerRef.current);
          ringTimerRef.current = null;
        }
        // Caller now starts as initiator → SimplePeer creates SDP offer
        // immediately, which gets relayed to the callee via rtc_offer.
        beginRtcSession(true)
          .then(() => {
            callStartedAtRef.current = Date.now();
            setCallElapsed(0);
            setCallState("in_call");
          })
          .catch((err) => {
            console.warn("[call] caller startCall failed:", err);
            setCallError(t("chat.call.err.mic"));
            setCallState("idle");
            wsRef.current?.send({ type: "rtc_hangup" });
          });
        return;
      case "peer_call_reject":
        if (ringTimerRef.current !== null) {
          window.clearTimeout(ringTimerRef.current);
          ringTimerRef.current = null;
        }
        setCallState("idle");
        setCallError(t("chat.call.err.rejected"));
        return;
      case "peer_call_cancel":
        setCallState("idle");
        return;
      case "peer_call_timeout":
        if (ringTimerRef.current !== null) {
          window.clearTimeout(ringTimerRef.current);
          ringTimerRef.current = null;
        }
        setCallState("idle");
        return;
      case "peer_rtc_offer":
      case "peer_rtc_answer":
      case "peer_rtc_ice":
        feedRemoteSignal(msg);
        return;
      case "peer_rtc_hangup":
        feedRemoteSignal(msg);
        teardownCall();
        setCallState("idle");
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

  function sendQuick(text: string): void {
    if (!wsRef.current?.isOpen()) return;
    if (connection !== "ready" || btInterrupted) return;
    wsRef.current.send({ type: "chat", text });
  }

  function rollDice(): void {
    if (!wsRef.current?.isOpen()) return;
    if (connection !== "ready" || btInterrupted) return;
    if (rolling.active) return;
    const outcomeIdx = Math.floor(Math.random() * DICE_FACES.length);
    wsRef.current.send({ type: "roll_start" });
    setRolling({ active: true, outcomeIdx });
    window.setTimeout(() => {
      setRolling({ active: false, outcomeIdx: null });
      if (!wsRef.current?.isOpen()) return;
      wsRef.current.send({
        type: "chat",
        text: DICE_FACES[outcomeIdx].text,
      });
    }, DICE_ANIM_MS);
  }

  async function handleLeave() {
    if (rtcIsInCall()) rtcHangup(false);
    teardownCall();
    setCallState("idle");
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
    if (connection === "waiting") return t("chat.status.waiting");
    if (connection === "ready") return t("chat.status.ready");
    if (connection === "disconnected") return t("chat.status.disconnected");
    if (connection === "terminated") return t("chat.status.terminated");
    return t("chat.status.connecting");
  }, [connection, t]);

  return (
    <div className="h-full flex flex-col md:flex-row text-black overflow-hidden relative">
      <div className="mesh-bg" />
      <div className="mesh-glow" />

      {/* Mobile header — Room + BT + 通话 + 退出 */}
      <div className="md:hidden shrink-0 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-xl border border-white/80 rounded-full pl-3 pr-1 py-1 shadow-sm">
          <span className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em]">
            {t("chat.pill.room")}
          </span>
          <span className="font-bold text-black text-xs tracking-[0.15em]">
            {code}
          </span>
          <CopyCode code={code} size={12} className="ml-0.5" />
        </div>
        <div className="flex items-center gap-2">
          <LangToggle compact />
          {role === "m" ? (
            <BluetoothStatus />
          ) : (
            <BluetoothStatus status={peerBtStatus} peer />
          )}
          {callState === "idle" && (
            <button
              onClick={startOutgoingCall}
              disabled={connection !== "ready"}
              className="w-9 h-9 rounded-full text-white flex items-center justify-center shadow-[0_8px_20px_rgba(255,138,61,0.35)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: BRAND }}
              aria-label={t("chat.call.start")}
            >
              <Phone size={15} strokeWidth={2.5} />
            </button>
          )}
          <button
            onClick={handleLeave}
            className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500 px-3 py-1.5 rounded-full bg-white/60 border border-red-200 active:bg-red-50"
          >
            {t("chat.exit")}
          </button>
        </div>
      </div>

      {callState === "in_call" && (
        <CallBar
          recording={sttListening}
          muted={callMuted}
          onToggleMute={toggleMute}
          onHangup={endCall}
          elapsed={callElapsed}
          className="md:hidden"
        />
      )}

      {/* Safety word banner — high-emphasis, visible at all times on both
          breakpoints. Mobile gets a dedicated row; desktop renders the
          same component absolutely positioned over the chat header area. */}
      <SafetyBanner safeWord={safeWord} className="md:hidden mx-4 mb-2" />

      {peerOffline.visible && (
        <PeerOfflineBanner expiresAt={peerOffline.expiresAt} />
      )}

      <div className="md:hidden shrink-0 flex items-center justify-center py-4 bg-white/30 backdrop-blur-sm">
        <IntensityViz intensity={intensity} compact />
      </div>

      {/* Chat column */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        <div className="hidden md:flex shrink-0 items-center justify-between px-6 py-4 gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <SafetyBanner safeWord={safeWord} />
            <div className="inline-flex items-center gap-1">
              <Pill label={t("chat.pill.room")} value={code} mono />
              <CopyCode code={code} size={14} />
            </div>
            <Pill label={t("chat.pill.role")} value={(role || "").toUpperCase()} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
              {statusText}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle />
            {role === "m" ? (
              <BluetoothStatus />
            ) : (
              <BluetoothStatus status={peerBtStatus} peer />
            )}
            {callState === "idle" && (
              <button
                onClick={startOutgoingCall}
                disabled={connection !== "ready"}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-white px-4 py-2 rounded-full hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ backgroundColor: BRAND }}
                aria-label={t("chat.call.start")}
              >
                <Phone size={13} strokeWidth={2.5} />
                Call
              </button>
            )}
            <button
              onClick={handleLeave}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 px-4 py-2 rounded-full bg-white/60 border border-red-200 hover:bg-red-50"
            >
              退出
            </button>
          </div>
        </div>

        {callState === "in_call" && (
          <CallBar
            recording={sttListening}
            muted={callMuted}
            onToggleMute={toggleMute}
            onHangup={endCall}
            elapsed={callElapsed}
            className="hidden md:flex"
          />
        )}

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4"
        >
          {messages.length === 0 && connection === "waiting" && (
            <WaitingPanel code={code} isCreator={isCreator} />
          )}
          {messages.length === 0 && connection === "ready" && (
            <div className="text-center text-[10px] font-black uppercase tracking-[0.25em] text-black/40 py-12">
              {t("chat.empty.start")}
            </div>
          )}
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} self={role!} />
          ))}
        </div>

        {/* Quick-send shortcuts — S only, always visible above input. First
            cell is the dice roller (random 1-6 face, uniform across 1/2/3
            intensity). The other three are deterministic keyword-table hits
            for the canonical demo levels. */}
        {/* M-only safe-word trigger — full-width red bar above the input.
            Tap once to broadcast the current safe word as a chat message,
            which goes through the existing pipeline and hits Layer 0
            (safe-word equality), terminating the session for both peers.
            Disabled while disconnected / BT interrupted / safeWord empty. */}
        {role === "m" && (
          <div className="shrink-0 px-3 sm:px-6 pt-2 sm:pt-3 pb-1">
            <button
              onClick={() => sendQuick(safeWord)}
              disabled={
                !safeWord || connection !== "ready" || btInterrupted
              }
              className="w-full py-3 sm:py-4 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-black tracking-wide shadow-[0_10px_30px_rgba(239,68,68,0.4)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              aria-label="发送安全词终止会话"
            >
              <Shield size={20} strokeWidth={2.5} />
              <span className="text-sm sm:text-base">
                安全词:{safeWord || "—"}
              </span>
            </button>
          </div>
        )}

        {role === "s" && (
          <div className="shrink-0 px-3 sm:px-6 pt-2 sm:pt-3 pb-1 flex flex-wrap gap-1.5 sm:gap-2">
            <button
              onClick={rollDice}
              disabled={connection !== "ready" || btInterrupted || rolling.active}
              className="text-sm sm:text-base px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-white shadow-[0_8px_20px_rgba(255,138,61,0.35)] active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: BRAND }}
              title="随机摇一档"
              aria-label="随机摇一档"
            >
              🎲
            </button>
            {QUICK_SHORTCUTS.map((q) => (
              <button
                key={q.label}
                onClick={() => sendQuick(q.text)}
                disabled={connection !== "ready" || btInterrupted}
                className="text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/70 hover:bg-white border border-white/80 backdrop-blur-md shadow-sm text-black active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed max-w-full truncate"
                title={q.text}
              >
                <span
                  className="font-black mr-1.5 sm:mr-2 text-[9px] uppercase tracking-[0.2em]"
                  style={{ color: BRAND }}
                >
                  {q.label}
                </span>
                <span className="font-bold">{q.text}</span>
              </button>
            ))}
          </div>
        )}

        <div className="shrink-0 px-3 sm:px-6 pt-2 sm:pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2 sm:gap-3 items-center">
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
                ? t("chat.input.bt.disconnected")
                : connection === "ready"
                ? t("chat.input.placeholder")
                : t("chat.input.connecting")
            }
            className="flex-1 min-w-0 bg-black text-white placeholder:text-white/30 rounded-full px-5 sm:px-6 py-4 sm:py-5 text-sm font-bold focus:outline-none focus:ring-8 focus:ring-[#FF8A3D]/10 shadow-[0_15px_40px_rgba(0,0,0,0.15)] disabled:opacity-40"
            maxLength={200}
          />
          <button
            onClick={send}
            disabled={connection !== "ready" || !input.trim() || btInterrupted}
            className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full text-white font-black flex items-center justify-center shadow-[0_15px_40px_rgba(255,138,61,0.4)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: BRAND }}
            aria-label="发送"
          >
            ➤
          </button>
        </div>
      </div>

      {/* Desktop viz panel */}
      <div className="hidden md:flex shrink-0 w-80 bg-white/30 backdrop-blur-sm items-center justify-center">
        <IntensityViz intensity={intensity} />
      </div>

      <DiceOverlay
        state={rolling}
        faces={DICE_FACES}
        intensitySuffix={language === "en" ? "" : " 档"}
      />

      {/* Hidden remote-audio sink — webrtc.ts attaches the peer's MediaStream
          here once the call is connected. autoPlay + playsInline so iOS
          Safari can resume audio inline without user gesture. */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <AnimatePresence>
        {(callState === "calling" || callState === "ringing") && (
          <RingingOverlay
            direction={callState === "calling" ? "outgoing" : "incoming"}
            onCancel={cancelOutgoingCall}
            onAccept={acceptIncomingCall}
            onReject={rejectIncomingCall}
            labels={{
              title:
                callState === "calling"
                  ? t("chat.ringing.outgoing")
                  : t("chat.ringing.incoming"),
              cancel: t("chat.ringing.cancel"),
              accept: t("chat.ringing.accept"),
              reject: t("chat.ringing.reject"),
            }}
          />
        )}
      </AnimatePresence>

      {callError && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="fixed left-1/2 -translate-x-1/2 top-[max(4rem,calc(env(safe-area-inset-top)+3rem))] z-[60] bg-black/85 text-white text-xs font-bold rounded-full px-5 py-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.3)]"
        >
          {callError}
        </motion.div>
      )}

      {/* BT interrupted overlay (M side only, non-demo) */}
      {btInterrupted && !terminatedBanner.visible && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-40 p-6">
          <div className="bg-white/90 backdrop-blur-3xl border border-white/80 rounded-[3rem] p-10 max-w-sm w-full text-center space-y-5 shadow-[0_40px_100px_rgba(0,0,0,0.15)]">
            <div className="inline-flex px-4 py-2 rounded-full bg-red-50 text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
              {t("chat.bt.lost.label")}
            </div>
            <div className="text-2xl font-black text-black">{t("chat.bt.lost.title")}</div>
            <div className="text-sm font-semibold text-black/50 leading-relaxed">
              {t("chat.bt.lost.desc")}
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleBtReconnect}
              disabled={btReconnecting}
              className="w-full h-16 rounded-full bg-black text-white text-sm font-black shadow-[0_15px_40px_rgba(0,0,0,0.2)] disabled:opacity-50"
            >
              {btReconnecting ? t("chat.bt.btn.connecting") : t("chat.bt.btn.reconnect")}
            </motion.button>
            <button
              onClick={handleLeave}
              className="w-full py-3 text-[10px] font-black uppercase tracking-[0.25em] text-red-500"
            >
              {t("chat.bt.btn.leave")}
            </button>
          </div>
        </div>
      )}

      {/* Terminated overlay */}
      {terminatedBanner.visible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white/90 backdrop-blur-3xl border border-white/80 rounded-[3rem] p-10 max-w-sm text-center shadow-[0_40px_100px_rgba(0,0,0,0.15)]">
            <div
              className={`inline-flex px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] mb-4 ${
                terminatedBanner.reason === "error"
                  ? "bg-red-50 text-red-500"
                  : "bg-black/5 text-black/40"
              }`}
            >
              {terminatedBanner.reason === "error"
                ? t("chat.terminated.subtitle.error")
                : t("chat.terminated.subtitle.closed")}
            </div>
            <div className="text-2xl font-black text-black mb-2">
              {terminatedBanner.reason === "safe_word"
                ? t("chat.terminated.safeword")
                : terminatedBanner.reason === "peer_left"
                ? t("chat.terminated.peer")
                : t("chat.terminated.error")}
            </div>
            {terminatedBanner.reason === "error" && (
              <div className="font-mono text-xs text-black/60 mb-3 bg-black/5 rounded-lg px-3 py-2">
                {terminatedBanner.errorCode}
                {terminatedBanner.errorMessage
                  ? ` — ${terminatedBanner.errorMessage}`
                  : ""}
              </div>
            )}
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40">
              {terminatedBanner.reason === "error"
                ? t("chat.terminated.error.hint")
                : t("chat.terminated.return.hint")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PillProps {
  label: string;
  value: string;
  mono?: boolean;
}

function Pill({ label, value, mono }: PillProps) {
  return (
    <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-xl border border-white/80 rounded-full px-4 py-2 shadow-sm">
      <span className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em]">
        {label}
      </span>
      <span
        className={`font-bold text-black text-xs ${mono ? "tracking-[0.15em]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

interface WaitingPanelProps {
  code: string;
  isCreator: boolean;
}

/**
 * Empty-state panel shown before peer has joined. Different copy + visual
 * weight depending on whether this user created the room (they need to
 * share the code) or joined someone else's (they're waiting for the
 * creator to come online — likely the creator is still on BtGate).
 *
 * For joiners we show a quiet hint after 30 s suggesting the code might
 * be wrong, since the typical "creator still pairing BT" case resolves
 * within ~10 s.
 */
function WaitingPanel({ code, isCreator }: WaitingPanelProps) {
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  const t = useT();
  useEffect(() => {
    const id = window.setTimeout(() => setWaitedTooLong(true), 30_000);
    return () => window.clearTimeout(id);
  }, []);

  if (isCreator) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/30">
          {t("chat.waiting.share.label")}
        </div>
        <div
          className="font-black text-4xl tracking-[0.25em]"
          style={{ color: BRAND }}
        >
          {code}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40">
          {t("chat.waiting.share.hint")}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/30">
        {t("chat.waiting.joining.label")}
      </div>
      <div className="font-black text-3xl tracking-[0.25em] text-black/60">
        {code}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40">
          {t("chat.waiting.joining.peer")}
        </span>
      </div>
      <div className="text-[11px] text-black/40 mt-2 px-6 text-center max-w-xs leading-relaxed">
        {t("chat.waiting.joining.hint")}
      </div>
      {waitedTooLong && (
        <div className="mt-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-2xl text-[11px] text-yellow-700 font-semibold max-w-xs text-center leading-relaxed">
          {t("chat.waiting.joining.timeout")}
        </div>
      )}
    </div>
  );
}

interface PeerOfflineBannerProps {
  expiresAt: number;
}

/**
 * Toast-style banner shown while the peer's slot is in grace (their WS
 * dropped, server holds it for the role-specific timeout). Counts down
 * the remaining seconds so the user knows when to give up.
 */
function PeerOfflineBanner({ expiresAt }: PeerOfflineBannerProps) {
  const [now, setNow] = useState(Date.now());
  const t = useT();
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      className="fixed left-1/2 -translate-x-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-30 bg-yellow-50 border-2 border-yellow-300 rounded-full px-5 py-2 flex items-center justify-center gap-3 shadow-[0_8px_24px_rgba(202,138,4,0.18)]"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-700">
          {t("chat.peer.offline")}
        </span>
      </div>
      <span className="text-[10px] font-black tracking-[0.2em] text-yellow-700">
        {remaining}s
      </span>
    </motion.div>
  );
}

interface SafetyBannerProps {
  safeWord: string;
  className?: string;
}

/**
 * Always-visible safe-word indicator. Higher emphasis than the other
 * pills (orange ring + Shield icon + larger value) because the user
 * may need to invoke it under stress and should never have to look
 * for it. Lives at the top of both mobile and desktop layouts.
 */
function SafetyBanner({ safeWord, className = "" }: SafetyBannerProps) {
  const t = useT();
  return (
    <div
      className={`inline-flex items-center gap-2.5 bg-white/80 backdrop-blur-xl rounded-full pl-3 pr-5 py-2 shadow-[0_8px_24px_rgba(255,138,61,0.18)] border-2 ${className}`}
      style={{ borderColor: BRAND }}
    >
      <span
        className="inline-flex w-7 h-7 rounded-full items-center justify-center shrink-0"
        style={{ backgroundColor: BRAND }}
      >
        <Shield size={14} className="text-white" strokeWidth={2.5} />
      </span>
      <div className="flex flex-col leading-none">
        <span
          className="text-[9px] font-black uppercase tracking-[0.25em]"
          style={{ color: BRAND }}
        >
          {t("chat.safetybanner.label")}
        </span>
        <span className="font-black text-black text-sm sm:text-base mt-0.5 truncate max-w-[40vw]">
          {safeWord || "—"}
        </span>
      </div>
    </div>
  );
}

interface RingingOverlayProps {
  direction: "outgoing" | "incoming";
  onCancel?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  labels: {
    title: string;
    cancel: string;
    accept: string;
    reject: string;
  };
}

/**
 * Pre-call modal — caller sees "正在呼叫…" with a Cancel button; callee sees
 * "对方呼叫" with Accept / Reject. Microphones are NOT opened until the
 * callee actually accepts (WeChat / Feishu-style pattern).
 */
function RingingOverlay({
  direction,
  onCancel,
  onAccept,
  onReject,
  labels,
}: RingingOverlayProps) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div className="mesh-bg" />
      <div className="mesh-glow" />
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative bg-white/85 backdrop-blur-3xl border border-white/80 rounded-[3rem] p-8 sm:p-10 max-w-sm w-full text-center shadow-[0_40px_100px_rgba(0,0,0,0.15)]"
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.3, repeat: Infinity }}
          className="inline-flex w-20 h-20 rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: BRAND }}
        >
          <Phone size={32} className="text-white" strokeWidth={2.5} />
        </motion.div>
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40 mb-2">
          {direction === "outgoing"
            ? t("chat.ringing.outgoing.subtitle")
            : t("chat.ringing.incoming.subtitle")}
        </div>
        <div className="text-2xl font-black text-black mb-8">
          {labels.title}
        </div>
        {direction === "outgoing" ? (
          <button
            onClick={onCancel}
            className="w-full h-14 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-black text-sm tracking-wide shadow-[0_15px_40px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2"
          >
            <PhoneOff size={18} strokeWidth={2.5} />
            {labels.cancel}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onReject}
              className="h-14 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-black text-sm shadow-[0_10px_30px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2"
            >
              <PhoneOff size={18} strokeWidth={2.5} />
              {labels.reject}
            </button>
            <button
              onClick={onAccept}
              className="h-14 rounded-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-black text-sm shadow-[0_10px_30px_rgba(34,197,94,0.4)] flex items-center justify-center gap-2"
            >
              <Phone size={18} strokeWidth={2.5} />
              {labels.accept}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

interface CallBarProps {
  recording: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onHangup: () => void;
  elapsed: number;
  className?: string;
}

/**
 * Inline call status bar — replaces the old fullscreen InCallOverlay so the
 * chat UI stays interactive during a voice call. Sits between the page
 * header and the SafetyBanner. Shows status (Live/Listening/Muted),
 * mm:ss elapsed, mic toggle, and a red hangup button. Intensity feedback
 * is already covered by IntensityViz on the chat page itself.
 */
function CallBar({
  recording,
  muted,
  onToggleMute,
  onHangup,
  elapsed,
  className = "",
}: CallBarProps) {
  const t = useT();
  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");
  return (
    <div className={`shrink-0 mx-4 md:mx-6 mb-2 flex items-center justify-between gap-3 bg-white/70 backdrop-blur-xl border border-white/80 rounded-full px-4 py-2 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${
            muted
              ? "bg-red-500"
              : recording
              ? "bg-green-500 animate-pulse"
              : "bg-yellow-500"
          }`}
        />
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-black/60">
          {muted ? t("chat.callbar.muted") : recording ? t("chat.callbar.listening") : t("chat.callbar.live")}
        </span>
        <span className="text-xs font-bold tabular-nums text-black/70 ml-1">
          {mm}:{ss}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleMute}
          className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all ${
            muted
              ? "bg-white/60 border border-white/80"
              : "bg-white border border-white/80"
          }`}
          aria-label={muted ? "取消静音" : "静音"}
        >
          {muted ? (
            <MicOff size={16} className="text-red-500" strokeWidth={2.5} />
          ) : (
            <Mic size={16} className="text-black" strokeWidth={2.5} />
          )}
        </button>
        <button
          onClick={onHangup}
          className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center shadow-[0_8px_20px_rgba(239,68,68,0.35)] active:scale-95 transition-all"
          aria-label="挂断"
        >
          <PhoneOff size={16} className="text-white" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

interface DiceOverlayProps {
  state: { active: boolean; outcomeIdx: number | null };
  faces: { label: string; text: string; intensity: 1 | 2 | 3 }[];
  intensitySuffix: string;
}

/**
 * Full-screen dice animation played on both peers in sync. The roller
 * (S) passes outcomeIdx so the final face matches; the observer (M) sees
 * the same cycling animation with no fixed outcome (the reveal comes in
 * via the normal chat-message path that follows).
 */
function DiceOverlay({ state, faces, intensitySuffix }: DiceOverlayProps) {
  const [cycleIdx, setCycleIdx] = useState(0);
  /** Settle latch — flips true in the final 300ms so the outcome face is
   *  revealed only at the end (was previously visible the whole time). */
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!state.active) {
      setSettled(false);
      return;
    }
    setCycleIdx(0);
    setSettled(false);
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % faces.length;
      setCycleIdx(i);
    }, DICE_CYCLE_MS);
    // Stop cycling at DICE_ANIM_MS - 300; show the chosen outcome for the
    // remaining 300ms. Observer side (outcomeIdx === null) keeps cycling
    // until the AnimatePresence exit kicks in.
    const settleTimer =
      state.outcomeIdx !== null
        ? window.setTimeout(() => {
            window.clearInterval(id);
            setSettled(true);
          }, Math.max(0, DICE_ANIM_MS - 300))
        : null;
    return () => {
      window.clearInterval(id);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
    };
  }, [state.active, faces.length, state.outcomeIdx]);

  const displayIdx =
    settled && state.outcomeIdx !== null ? state.outcomeIdx : cycleIdx;
  const face = faces[displayIdx];

  return (
    <AnimatePresence>
      {state.active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            animate={{
              rotate: [0, 90, 180, 270, 360, 720, 1080],
              scale: [0.6, 1.15, 0.9, 1.05, 0.95, 1, 1],
            }}
            transition={{ duration: DICE_ANIM_MS / 1000, ease: "easeOut" }}
            className="bg-white rounded-tile shadow-card px-6 sm:px-8 py-5 sm:py-6 flex flex-col items-center gap-2 min-w-[180px] sm:min-w-[220px] max-w-[85vw]"
          >
            <div className="text-5xl sm:text-6xl leading-none">{face.label}</div>
            <div className="text-sm sm:text-base font-semibold text-ink-900 text-center px-2">
              {face.text}
            </div>
            <div className="text-xs text-accent-500 font-semibold">
              {face.intensity}{intensitySuffix}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
