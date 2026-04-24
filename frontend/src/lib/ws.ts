import type { ClientMsg, Role, ServerMsg } from "@attrax/shared";

export interface WsHandle {
  send(msg: ClientMsg): void;
  leave(): void;
  close(): void;
  isOpen(): boolean;
}

export interface ConnectOpts {
  code: string;
  role: Role;
  safeWord?: string;
  onMessage(msg: ServerMsg): void;
  onStatus(status: "connecting" | "open" | "closed" | "error"): void;
}

const BACKOFF_MS = [500, 1000, 2000, 4000];

export function connect(opts: ConnectOpts): WsHandle {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let closedByUser = false;
  let reconnectTimer: number | null = null;
  let pingTimer: number | null = null;

  function buildUrl(): string {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    const params = new URLSearchParams({ code: opts.code, role: opts.role });
    // Either role may bring a safe word at connect time. Server applies
    // first-write-wins and ignores subsequent values.
    if (opts.safeWord) {
      params.set("safeWord", opts.safeWord);
    }
    return `${scheme}://${host}/ws?${params.toString()}`;
  }

  function open() {
    opts.onStatus("connecting");
    ws = new WebSocket(buildUrl());

    ws.addEventListener("open", () => {
      attempt = 0;
      opts.onStatus("open");
      // heartbeat
      if (pingTimer) window.clearInterval(pingTimer);
      pingTimer = window.setInterval(() => {
        send({ type: "ping" });
      }, 15_000);
    });

    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerMsg;
        opts.onMessage(msg);
      } catch {
        // ignore malformed frames
      }
    });

    ws.addEventListener("error", () => {
      opts.onStatus("error");
    });

    ws.addEventListener("close", () => {
      if (pingTimer) {
        window.clearInterval(pingTimer);
        pingTimer = null;
      }
      opts.onStatus("closed");
      if (closedByUser) return;
      // Exponential backoff reconnect, matching PRD §4.5 30s window
      const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      attempt += 1;
      reconnectTimer = window.setTimeout(open, wait);
    });
  }

  function send(msg: ClientMsg) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(msg));
  }

  function isOpen() {
    return !!ws && ws.readyState === WebSocket.OPEN;
  }

  function leave() {
    closedByUser = true;
    send({ type: "leave" });
    close();
  }

  function close() {
    closedByUser = true;
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (pingTimer) {
      window.clearInterval(pingTimer);
      pingTimer = null;
    }
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore
      }
      ws = null;
    }
  }

  open();

  return { send, leave, close, isOpen };
}
