import type { Intensity, Role } from "@attrax/shared";
import { create } from "zustand";
import { detectInitialLang, persistLang } from "./i18n/index.js";
import type { Lang } from "./i18n/strings.js";

export type Page = "landing" | "login" | "bt_gate" | "chat" | "terminated";

export interface ChatMessage {
  id: string;
  from: Role;
  text: string;
  intensity: Intensity;
  reason: string | null;
  seq_id: number;
  timestamp: number;
}

export type ConnectionStatus =
  | "idle"
  | "waiting"
  | "ready"
  | "disconnected"
  | "terminated";

/**
 * Ringing protocol state machine.
 *   idle      — no call in progress
 *   calling   — local user pressed 📞, waiting for peer to accept
 *   ringing   — peer is calling us, waiting for local user to accept / reject
 *   in_call   — both sides accepted, SDP negotiated, audio is flowing
 */
export type CallState = "idle" | "calling" | "ringing" | "in_call";

interface AppState {
  page: Page;
  language: Lang;
  role: Role | null;
  code: string;
  safeWord: string;
  /** True when the user explicitly skipped BT pairing via "演示模式". */
  demoMode: boolean;
  /** True when this user submitted Login in "Create" mode (vs "Join"). */
  isCreator: boolean;
  connection: ConnectionStatus;
  callState: CallState;
  messages: ChatMessage[];
  intensity: Intensity;
  lastAppliedSeqId: number;

  setPage: (p: Page) => void;
  setLanguage: (l: Lang) => void;
  setRole: (r: Role) => void;
  setCode: (c: string) => void;
  setSafeWord: (w: string) => void;
  setDemoMode: (v: boolean) => void;
  setIsCreator: (v: boolean) => void;
  setConnection: (s: ConnectionStatus) => void;
  setCallState: (s: CallState) => void;

  appendMessage: (m: ChatMessage) => void;
  resetSession: () => void;
  terminate: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Cold-start lands on the marketing hero. resetSession returns to "login"
  // (not "landing") so a user who just terminated a session doesn't have to
  // re-watch the hero before re-entering.
  page: "landing",
  language: detectInitialLang(),
  role: null,
  code: "",
  safeWord: "",
  demoMode: false,
  isCreator: false,
  connection: "idle",
  callState: "idle",
  messages: [],
  intensity: 0,
  lastAppliedSeqId: 0,

  setPage: (page) => set({ page }),
  setLanguage: (language) => {
    persistLang(language);
    set({ language });
  },
  setRole: (role) => set({ role }),
  setCode: (code) => set({ code }),
  setSafeWord: (safeWord) => set({ safeWord }),
  setDemoMode: (demoMode) => set({ demoMode }),
  setIsCreator: (isCreator) => set({ isCreator }),
  setConnection: (connection) => set({ connection }),
  setCallState: (callState) => set({ callState }),

  appendMessage: (m) =>
    set((state) => {
      const nextMessages = [...state.messages, m];
      // Only apply intensity update if seq_id is strictly greater than last applied.
      // Stale messages (e.g. late-returning Gemini classifications) still render
      // their bubble but do NOT change intensity.
      if (m.seq_id > state.lastAppliedSeqId) {
        return {
          messages: nextMessages,
          intensity: m.intensity,
          lastAppliedSeqId: m.seq_id,
        };
      }
      return { messages: nextMessages };
    }),

  resetSession: () =>
    set({
      page: "login",
      role: null,
      code: "",
      safeWord: "",
      demoMode: false,
      isCreator: false,
      connection: "idle",
      callState: "idle",
      messages: [],
      intensity: 0,
      lastAppliedSeqId: 0,
    }),

  terminate: () =>
    set({
      page: "terminated",
      connection: "terminated",
      callState: "idle",
      intensity: 0,
    }),
}));
