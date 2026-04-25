import type { Intensity, Role } from "@attrax/shared";
import { create } from "zustand";

export type Page = "login" | "bt_gate" | "chat" | "terminated";

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

interface AppState {
  page: Page;
  role: Role | null;
  code: string;
  safeWord: string;
  /** True when the user explicitly skipped BT pairing via "演示模式". */
  demoMode: boolean;
  /** True when this user submitted Login in "Create" mode (vs "Join"). */
  isCreator: boolean;
  connection: ConnectionStatus;
  messages: ChatMessage[];
  intensity: Intensity;
  lastAppliedSeqId: number;

  setPage: (p: Page) => void;
  setRole: (r: Role) => void;
  setCode: (c: string) => void;
  setSafeWord: (w: string) => void;
  setDemoMode: (v: boolean) => void;
  setIsCreator: (v: boolean) => void;
  setConnection: (s: ConnectionStatus) => void;

  appendMessage: (m: ChatMessage) => void;
  resetSession: () => void;
  terminate: () => void;
}

export const useStore = create<AppState>((set) => ({
  page: "login",
  role: null,
  code: "",
  safeWord: "",
  demoMode: false,
  isCreator: false,
  connection: "idle",
  messages: [],
  intensity: 0,
  lastAppliedSeqId: 0,

  setPage: (page) => set({ page }),
  setRole: (role) => set({ role }),
  setCode: (code) => set({ code }),
  setSafeWord: (safeWord) => set({ safeWord }),
  setDemoMode: (demoMode) => set({ demoMode }),
  setIsCreator: (isCreator) => set({ isCreator }),
  setConnection: (connection) => set({ connection }),

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
      messages: [],
      intensity: 0,
      lastAppliedSeqId: 0,
    }),

  terminate: () =>
    set({
      page: "terminated",
      connection: "terminated",
      intensity: 0,
    }),
}));
