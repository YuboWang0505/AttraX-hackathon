export type Role = "s" | "m";

export type Intensity = 0 | 1 | 2 | 3;

/** Broadcast-friendly subset of bluetooth.ts BtStatus. */
export type BtBroadcastStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "offline"
  | "error";

export type ClientMsg =
  | { type: "set_safe_word"; word: string }
  | { type: "chat"; text: string }
  | { type: "bt_status"; status: BtBroadcastStatus }
  | { type: "leave" }
  | { type: "ping" }
  // S rolls an intensity die; server fans out so M can play the same
  // animation in sync. Outcome follows as a normal chat message.
  | { type: "roll_start" };

export type ErrorCode =
  | "ROOM_FULL"
  | "ROLE_TAKEN"
  | "INVALID_CODE"
  | "INVALID_CODE_FORMAT";

export type ServerMsg =
  | { type: "room_ready"; selfRole: Role; peerRole: Role; safeWord: string }
  // safeWord may already be set when only one slot is filled (e.g. the
  // creator already pre-registered it). Joiner uses it to populate the
  // SafetyBanner without waiting for both sides to be online.
  | { type: "room_waiting"; safeWord: string | null }
  | {
      type: "chat";
      from: Role;
      text: string;
      intensity: Intensity;
      /** Short natural-language summary from the LLM (or null if rule/fallback path). */
      reason: string | null;
      seq_id: number;
      timestamp: number;
    }
  | { type: "safe_word_triggered"; by: Role }
  | { type: "peer_bt_status"; role: Role; status: BtBroadcastStatus }
  // Peer's WS dropped but we're holding the slot for them — UI should
  // surface a "peer offline, waiting for reconnect" banner. graceMs is
  // the role-specific grace window remaining (S=15s, M=60s).
  | { type: "peer_disconnecting"; role: Role; graceMs: number }
  // Peer reconnected within the grace window. UI should clear any
  // disconnect banner. After this, M may want to verify its BT link.
  | { type: "peer_reconnected"; role: Role }
  | { type: "peer_left" }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "pong" }
  // Peer started rolling a die — show the same animation locally. The
  // selected face arrives later as a normal chat message.
  | { type: "peer_roll_start" };
