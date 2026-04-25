import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ServerMsg } from "@attrax/shared";
import { BluetoothStatus } from "../components/BluetoothStatus.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { IntensityViz } from "../components/IntensityViz.js";
import * as bt from "../lib/bluetooth.js";
import type { BtStatus } from "../lib/bluetooth.js";
import { connect, type WsHandle } from "../lib/ws.js";
import { useStore } from "../store.js";

// Demo shortcuts — each string deterministically hits the Layer-1 keyword
// table for the labeled intensity level (verified via keyword-table.ts).
// Keeps demo timing tight (<10ms response) and removes network dependency
// for the canonical S_WARM_UP / S_COMMAND_POSTURE / S_REWARD_HIGH cases.
const QUICK_SHORTCUTS: { label: string; text: string }[] = [
  { label: "1档", text: "乖,放松" },
  { label: "2档", text: "给我跪好" },
  { label: "3档", text: "表现得太棒了,这是给你的最高奖励。" },
];

const BRAND = "#FF8A3D";

// Dice faces — uniform distribution across 1/2/3, two per level. Each
// face's text deterministically hits the keyword table so the outcome
// is shown instantly after animation ends.
const DICE_FACES: { label: string; text: string; intensity: 1 | 2 | 3 }[] = [
  { label: "⚀", text: "乖,放松", intensity: 1 },
  { label: "⚁", text: "抱抱,辛苦了", intensity: 1 },
  { label: "⚂", text: "给我跪好", intensity: 2 },
  { label: "⚃", text: "求我", intensity: 2 },
  { label: "⚄", text: "给我丢", intensity: 3 },
  { label: "⚅", text: "狠狠惩罚", intensity: 3 },
];

const DICE_ANIM_MS = 1500;
const DICE_CYCLE_MS = 110;

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
  /** Dice animation state. `outcomeIdx` set only on the roller (S) side. */
  const [rolling, setRolling] = useState<{
    active: boolean;
    outcomeIdx: number | null;
  }>({ active: false, outcomeIdx: null });

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
      case "peer_roll_start":
        // Mirror the same anim on our side. outcomeIdx stays null — we
        // don't know the face yet and don't need to; the selected text
        // arrives as a normal chat message right after animation ends.
        setRolling({ active: true, outcomeIdx: null });
        window.setTimeout(() => {
          setRolling((r) => (r.active ? { active: false, outcomeIdx: null } : r));
        }, DICE_ANIM_MS);
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
    <div className="h-full flex flex-col md:flex-row text-black overflow-hidden relative">
      <div className="mesh-bg" />
      <div className="mesh-glow" />

      {/* Mobile header — white frosted pill row */}
      <div className="md:hidden shrink-0 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-xl border border-white/80 rounded-full px-4 py-2 shadow-sm">
          <span className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em]">
            Room
          </span>
          <span className="font-bold text-black text-xs tracking-[0.15em]">
            {code}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {role === "m" ? (
            <BluetoothStatus />
          ) : (
            <BluetoothStatus status={peerBtStatus} peer />
          )}
          <button
            onClick={handleLeave}
            className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500 px-3 py-1.5 rounded-full bg-white/60 border border-red-200 active:bg-red-50"
          >
            退出
          </button>
        </div>
      </div>

      <div className="md:hidden shrink-0 flex items-center justify-center py-4 bg-white/30 backdrop-blur-sm">
        <IntensityViz intensity={intensity} compact />
      </div>

      {/* Chat column */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        <div className="hidden md:flex shrink-0 items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Pill label="Safety" value={safeWord || "—"} />
            <Pill label="Room" value={code} mono />
            <Pill label="Role" value={(role || "").toUpperCase()} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
              {statusText}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {role === "m" ? (
              <BluetoothStatus />
            ) : (
              <BluetoothStatus status={peerBtStatus} peer />
            )}
            <button
              onClick={handleLeave}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 px-4 py-2 rounded-full bg-white/60 border border-red-200 hover:bg-red-50"
            >
              退出
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4"
        >
          {messages.length === 0 && connection === "waiting" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/30">
                Share Room Code
              </div>
              <div
                className="font-black text-4xl tracking-[0.25em]"
                style={{ color: BRAND }}
              >
                {code}
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40">
                等待对方加入…
              </div>
              {safeWord && (
                <div className="inline-flex items-center gap-2 bg-white/60 border border-white/80 px-4 py-2 rounded-full shadow-sm">
                  <span className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em]">
                    Safety
                  </span>
                  <span className="font-bold text-black text-sm">{safeWord}</span>
                </div>
              )}
            </div>
          )}
          {messages.length === 0 && connection === "ready" && (
            <div className="text-center text-[10px] font-black uppercase tracking-[0.25em] text-black/40 py-12">
              开始聊天吧 · S 的消息会驱动档位变化
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
                ? "硬件已断开,请重连"
                : connection === "ready"
                ? "输入消息…"
                : "等待连接…"
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

      <DiceOverlay state={rolling} />

      {/* BT interrupted overlay (M side only, non-demo) */}
      {btInterrupted && !terminatedBanner.visible && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-40 p-6">
          <div className="bg-white/90 backdrop-blur-3xl border border-white/80 rounded-[3rem] p-10 max-w-sm w-full text-center space-y-5 shadow-[0_40px_100px_rgba(0,0,0,0.15)]">
            <div className="inline-flex px-4 py-2 rounded-full bg-red-50 text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
              Bluetooth Lost
            </div>
            <div className="text-2xl font-black text-black">蓝牙已断开</div>
            <div className="text-sm font-semibold text-black/50 leading-relaxed">
              硬件跳蛋的连接丢失。聊天已暂停。
              <br />
              请重新连接硬件或退出会话。
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleBtReconnect}
              disabled={btReconnecting}
              className="w-full h-16 rounded-full bg-black text-white text-sm font-black shadow-[0_15px_40px_rgba(0,0,0,0.2)] disabled:opacity-50"
            >
              {btReconnecting ? "连接中…" : "重新连接硬件"}
            </motion.button>
            <button
              onClick={handleLeave}
              className="w-full py-3 text-[10px] font-black uppercase tracking-[0.25em] text-red-500"
            >
              退出会话
            </button>
          </div>
        </div>
      )}

      {/* Terminated overlay */}
      {terminatedBanner.visible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white/90 backdrop-blur-3xl border border-white/80 rounded-[3rem] p-10 max-w-sm text-center shadow-[0_40px_100px_rgba(0,0,0,0.15)]">
            <div className="inline-flex px-4 py-2 rounded-full bg-black/5 text-[10px] font-black uppercase tracking-[0.25em] text-black/40 mb-4">
              Session Closed
            </div>
            <div className="text-2xl font-black text-black mb-2">
              {terminatedBanner.reason === "safe_word"
                ? "会话已安全终止"
                : "对方已离开"}
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/40">
              2 秒后返回登入页…
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

interface DiceOverlayProps {
  state: { active: boolean; outcomeIdx: number | null };
}

/**
 * Full-screen dice animation played on both peers in sync. The roller
 * (S) passes outcomeIdx so the final face matches; the observer (M) sees
 * the same cycling animation with no fixed outcome (the reveal comes in
 * via the normal chat-message path that follows).
 */
function DiceOverlay({ state }: DiceOverlayProps) {
  const [cycleIdx, setCycleIdx] = useState(0);

  useEffect(() => {
    if (!state.active) return;
    setCycleIdx(0);
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % DICE_FACES.length;
      setCycleIdx(i);
    }, DICE_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [state.active]);

  // Settle phase — last 300ms show the final face (roller only).
  const showOutcome = state.outcomeIdx !== null;
  const displayIdx = showOutcome ? state.outcomeIdx! : cycleIdx;
  const face = DICE_FACES[displayIdx];

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
              {face.intensity} 档
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
