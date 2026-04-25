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
  // S rolls an intensity die; server fans out so M can play the same
  // animation in sync. Outcome follows as a normal chat message.
  | { type: "roll_start" }
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
  // One-tap emergency stop from a big red button. Routed through the
  // same path as a typed safe word, so all disconnect/grace logic stays
  // intact — pipeline just bypasses STT / LLM.
  | { type: "emergency_stop" };

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
  | { type: "peer_roll_start" }
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
