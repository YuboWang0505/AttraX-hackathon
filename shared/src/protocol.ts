export type Role = "s" | "m";

export type Intensity = 0 | 1 | 2 | 3;

/** Broadcast-friendly subset of bluetooth.ts BtStatus. */
export type BtBroadcastStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "offline"
  | "error";

/** Minimal subset of RTCIceCandidateInit we relay (structured-clone safe). */
export interface RelayIceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export type ClientMsg =
  | { type: "set_safe_word"; word: string }
  | { type: "chat"; text: string }
  | { type: "bt_status"; status: BtBroadcastStatus }
  | { type: "leave" }
  | { type: "ping" }
  // Voice call (v2) — application-layer ringing protocol. Both sides agree
  // via invite/accept BEFORE any SDP is generated, so the microphone only
  // opens once the callee has actually picked up (WeChat / Feishu-style).
  | { type: "call_invite" }
  | { type: "call_accept" }
  | { type: "call_reject" }
  | { type: "call_cancel" }
  | { type: "call_timeout" }
  // WebRTC signaling relayed transparently to peer. Only sent after the
  // call has been accepted on both sides.
  | { type: "rtc_offer"; sdp: string }
  | { type: "rtc_answer"; sdp: string }
  | { type: "rtc_ice"; candidate: RelayIceCandidate }
  | { type: "rtc_hangup" }
  // One-tap emergency stop from a big red button. Bypasses STT / LLM and
  // fires the same termination path as a typed safe word.
  | { type: "emergency_stop" };

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
  | { type: "pong" }
  // Ringing protocol relays.
  | { type: "peer_call_invite"; from: Role }
  | { type: "peer_call_accept" }
  | { type: "peer_call_reject" }
  | { type: "peer_call_cancel" }
  | { type: "peer_call_timeout" }
  // WebRTC signaling relays — server passes these through from the other role.
  | { type: "peer_rtc_offer"; sdp: string }
  | { type: "peer_rtc_answer"; sdp: string }
  | { type: "peer_rtc_ice"; candidate: RelayIceCandidate }
  | { type: "peer_rtc_hangup" };
