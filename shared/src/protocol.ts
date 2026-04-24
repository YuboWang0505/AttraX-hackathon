export type Role = "s" | "m";

export type Intensity = 0 | 1 | 2 | 3;

export type IntentCode =
  | "SYS_SAFE_WORD"
  | "S_WARM_UP"
  | "S_GREET_WARM"
  | "S_GREET_DOM"
  | "S_TEASE_LIGHT"
  | "S_TEASE_HEAVY"
  | "S_COMMAND_DAILY"
  | "S_COMMAND_POSTURE"
  | "S_COMMAND_VERBAL"
  | "S_DENIAL_CONTROL"
  | "S_WARNING"
  | "S_PUNISH_LIGHT"
  | "S_PUNISH_STRICT"
  | "S_CLIMAX_PERMISSION"
  | "S_CLIMAX_FORCED"
  | "S_REWARD_HIGH"
  | "S_AFTERCARE";

export type ClientMsg =
  | { type: "set_safe_word"; word: string }
  | { type: "chat"; text: string }
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
      intent_code: IntentCode;
      seq_id: number;
      timestamp: number;
    }
  | { type: "safe_word_triggered"; by: Role }
  | { type: "peer_left" }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "pong" };
