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
  | { type: "ping" };

export type ErrorCode =
  | "ROOM_FULL"
  | "ROLE_TAKEN"
  | "INVALID_CODE"
  | "INVALID_CODE_FORMAT";

export type ServerMsg =
  | { type: "room_ready"; selfRole: Role; peerRole: Role; safeWord: string }
  | { type: "room_waiting" }
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
  | { type: "peer_left" }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "pong" };
