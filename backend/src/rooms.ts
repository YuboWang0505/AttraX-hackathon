import type {
  ClientMsg,
  ErrorCode,
  Intensity,
  Role,
  ServerMsg,
} from "@attrax/shared";
import type { WebSocket } from "ws";
import { runPipeline } from "./intent/pipeline.js";
import { sanitizeSafeWord } from "./safe-word.js";

const RECONNECT_WINDOW_MS = 30_000;
const IDLE_WINDOW_MS = 30 * 60 * 1000; // 30 min

export interface Room {
  code: string;
  safeWord: string;
  sWs: WebSocket | null;
  mWs: WebSocket | null;
  seqCounter: number;
  /** Last intensity applied by S. M messages do NOT change this. */
  currentIntensity: Intensity;
  createdAt: number;
  lastActivity: number;
  /** If role is disconnected, ms timestamp when we started the grace window. */
  sDisconnectAt: number | null;
  mDisconnectAt: number | null;
  /** Timers for the grace-window expiry → peer_left. */
  sGraceTimer: NodeJS.Timeout | null;
  mGraceTimer: NodeJS.Timeout | null;
}

const rooms = new Map<string, Room>();

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function roomCount(): number {
  return rooms.size;
}

export function generateCode(): string {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!rooms.has(code)) return code;
  }
  throw new Error("could not generate unique code after 20 tries");
}

export function isValidCode(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code);
}

function sendJson(ws: WebSocket | null, msg: ServerMsg): void {
  if (!ws) return;
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function sendError(ws: WebSocket, code: ErrorCode, message: string): void {
  sendJson(ws, { type: "error", code, message });
  try {
    ws.close();
  } catch {
    // ignore
  }
}

function peerOf(room: Room, self: Role): WebSocket | null {
  return self === "s" ? room.mWs : room.sWs;
}

function selfWsOf(room: Room, self: Role): WebSocket | null {
  return self === "s" ? room.sWs : room.mWs;
}

function setWs(room: Room, role: Role, ws: WebSocket | null): void {
  if (role === "s") room.sWs = ws;
  else room.mWs = ws;
}

function setDisconnectAt(room: Room, role: Role, v: number | null): void {
  if (role === "s") room.sDisconnectAt = v;
  else room.mDisconnectAt = v;
}

function clearGraceTimer(room: Room, role: Role): void {
  const key = role === "s" ? "sGraceTimer" : "mGraceTimer";
  if (room[key]) {
    clearTimeout(room[key]!);
    room[key] = null;
  }
}

function startGraceTimer(room: Room, role: Role): void {
  clearGraceTimer(room, role);
  const key = role === "s" ? "sGraceTimer" : "mGraceTimer";
  room[key] = setTimeout(() => {
    onGraceExpired(room, role);
  }, RECONNECT_WINDOW_MS);
}

function onGraceExpired(room: Room, role: Role): void {
  // Role slot did not reconnect. Notify peer and close room.
  setDisconnectAt(room, role, null);
  setWs(room, role, null);
  const peer = peerOf(room, role);
  sendJson(peer, { type: "peer_left" });
  if (peer && peer.readyState === peer.OPEN) {
    try {
      peer.close();
    } catch {
      // ignore
    }
  }
  closeRoom(room.code);
}

function closeRoom(code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  clearGraceTimer(room, "s");
  clearGraceTimer(room, "m");
  rooms.delete(code);
}

function bothReady(room: Room): boolean {
  return !!room.sWs && !!room.mWs && !!room.safeWord;
}

function pushRoomState(room: Room, target: Role): void {
  const ws = selfWsOf(room, target);
  if (!ws) return;
  if (bothReady(room)) {
    sendJson(ws, {
      type: "room_ready",
      selfRole: target,
      peerRole: target === "s" ? "m" : "s",
      safeWord: room.safeWord,
    });
  } else {
    sendJson(ws, { type: "room_waiting" });
  }
}

export interface ConnectParams {
  code: string;
  role: Role;
  safeWord?: string;
}

/**
 * Attach an incoming WS to a room, creating the room if needed.
 * Handles role conflicts, reconnect within the 30s grace window, and
 * safe-word initialization from the query string (M only).
 */
export function handleConnection(ws: WebSocket, params: ConnectParams): void {
  const { code, role } = params;

  if (!isValidCode(code)) {
    sendError(ws, "INVALID_CODE_FORMAT", "code must be 6 digits");
    return;
  }

  let room = rooms.get(code);
  const isReconnect = !!room && !!(role === "s" ? room.sDisconnectAt : room.mDisconnectAt);

  if (!room) {
    room = createRoom(code);
  }

  const existingWs = selfWsOf(room, role);
  if (existingWs && existingWs.readyState === existingWs.OPEN && !isReconnect) {
    sendError(ws, "ROLE_TAKEN", `role ${role} already taken in room ${code}`);
    return;
  }

  if (room.sWs && room.mWs && selfWsOf(room, role) == null) {
    // Defensive: shouldn't hit, both slots filled by someone else
    sendError(ws, "ROOM_FULL", `room ${code} is full`);
    return;
  }

  if (isReconnect) {
    clearGraceTimer(room, role);
    setDisconnectAt(room, role, null);
  }

  // Accept ws into the slot
  setWs(room, role, ws);

  // Safe-word initialization: either role may bring the safe word at connect
  // time via the query param. First provided value wins — subsequent joiners'
  // values are ignored silently.
  if (!room.safeWord && params.safeWord !== undefined) {
    room.safeWord = sanitizeSafeWord(params.safeWord);
  }

  // Fallback: once both sockets are attached, guarantee a safe word exists so
  // the room can enter READY. Default value handles the case where neither
  // side passed safeWord on connect.
  if (room.sWs && room.mWs && !room.safeWord) {
    room.safeWord = sanitizeSafeWord(undefined);
  }

  room.lastActivity = Date.now();

  // Announce state to this socket and (if now ready) to peer
  pushRoomState(room, role);
  const peer: Role = role === "s" ? "m" : "s";
  if (bothReady(room)) {
    pushRoomState(room, peer);
  }

  ws.on("message", (data) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    handleMessage(room!, role, msg);
  });

  ws.on("close", () => {
    handleClose(room!, role, ws);
  });

  ws.on("error", () => {
    // Let close handler do cleanup
  });
}

function createRoom(code: string): Room {
  const room: Room = {
    code,
    safeWord: "",
    sWs: null,
    mWs: null,
    seqCounter: 0,
    currentIntensity: 0,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    sDisconnectAt: null,
    mDisconnectAt: null,
    sGraceTimer: null,
    mGraceTimer: null,
  };
  rooms.set(code, room);
  return room;
}

async function handleMessage(room: Room, role: Role, msg: ClientMsg): Promise<void> {
  room.lastActivity = Date.now();

  switch (msg.type) {
    case "ping":
      sendJson(selfWsOf(room, role), { type: "pong" });
      return;

    case "leave": {
      const peer = peerOf(room, role);
      sendJson(peer, { type: "peer_left" });
      if (peer && peer.readyState === peer.OPEN) {
        try {
          peer.close();
        } catch {
          // ignore
        }
      }
      const self = selfWsOf(room, role);
      if (self && self.readyState === self.OPEN) {
        try {
          self.close();
        } catch {
          // ignore
        }
      }
      closeRoom(room.code);
      return;
    }

    case "set_safe_word": {
      // First-write-wins, either role. Silently ignored after safeWord is set.
      if (room.safeWord) return;
      room.safeWord = sanitizeSafeWord(msg.word);
      if (bothReady(room)) {
        pushRoomState(room, "s");
        pushRoomState(room, "m");
      }
      return;
    }

    case "bt_status": {
      // Relay sender's local BT state to the peer so S can tell whether
      // M's hardware is actually paired.
      const peer = peerOf(room, role);
      sendJson(peer, { type: "peer_bt_status", role, status: msg.status });
      return;
    }

    case "chat": {
      if (!bothReady(room)) return;
      // Assign seq_id synchronously BEFORE any await — preserves send order.
      const seq_id = ++room.seqCounter;
      const text = (msg.text ?? "").toString().slice(0, 200);
      if (!text) return;

      const result = await runPipeline(text, room.safeWord);

      if (result.safeWordTriggered) {
        const broadcast: ServerMsg = { type: "safe_word_triggered", by: role };
        sendJson(room.sWs, broadcast);
        sendJson(room.mWs, broadcast);
        if (room.sWs && room.sWs.readyState === room.sWs.OPEN) {
          try {
            room.sWs.close();
          } catch {
            // ignore
          }
        }
        if (room.mWs && room.mWs.readyState === room.mWs.OPEN) {
          try {
            room.mWs.close();
          } catch {
            // ignore
          }
        }
        closeRoom(room.code);
        return;
      }

      // Only S messages may change intensity. M messages always hold.
      // On S side: if the LLM returned a concrete 0-3 it's a directive →
      // update current level. If it returned null (non-directive: ack,
      // question, pacing cue, off-topic, low-confidence), we hold the
      // current level — do NOT reset to 1, which would surprise users
      // mid-scene when S just says "嗯" or "慢慢来".
      if (role === "s" && result.intensity !== null) {
        room.currentIntensity = result.intensity;
      }

      const out: ServerMsg = {
        type: "chat",
        from: role,
        text,
        intensity: room.currentIntensity,
        reason: result.reason,
        seq_id,
        timestamp: Date.now(),
      };
      sendJson(room.sWs, out);
      sendJson(room.mWs, out);
      return;
    }
  }
}

function handleClose(room: Room, role: Role, ws: WebSocket): void {
  // Only treat as disconnect if this ws is still the active slot (avoid
  // stale close events after reconnect replaces the slot)
  if (selfWsOf(room, role) !== ws) return;

  // If the other role is already absent, close the room immediately
  const peer = peerOf(room, role);
  if (!peer) {
    setWs(room, role, null);
    closeRoom(room.code);
    return;
  }

  // Start 30s grace window
  setDisconnectAt(room, role, Date.now());
  startGraceTimer(room, role);
  // IMPORTANT: do not send peer_left yet — reconnect may cancel it
}

// Periodic sweeper for idle rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > IDLE_WINDOW_MS) {
      const peer1 = room.sWs;
      const peer2 = room.mWs;
      sendJson(peer1, { type: "peer_left" });
      sendJson(peer2, { type: "peer_left" });
      try {
        peer1?.close();
      } catch {
        // ignore
      }
      try {
        peer2?.close();
      } catch {
        // ignore
      }
      closeRoom(code);
    }
  }
}, 60_000).unref();
