import type { ClientMsg, Role, ServerMsg } from "@attrax/shared";
import { backendWsUrl } from "./config.js";

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
const PING_INTERVAL_MS = 15_000;
// If we go this long without seeing any frame from the server (any
// message, including pong), assume the WS is half-dead and force-close
// it so the auto-reconnect logic kicks in. Two missed pongs (~30s) is
// the cutoff.
const SILENCE_TIMEOUT_MS = 35_000;

export function connect(opts: ConnectOpts): WsHandle {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let closedByUser = false;
  let reconnectTimer: number | null = null;
  let pingTimer: number | null = null;
  let watchdog: number | null = null;
  let lastFrameAt = 0;

  function buildUrl(): string {
    const params = new URLSearchParams({ code: opts.code, role: opts.role });
    // Either role may bring a safe word at connect time. Server applies
    // first-write-wins and ignores subsequent values.
    if (opts.safeWord) {
      params.set("safeWord", opts.safeWord);
    }
    return `${backendWsUrl("/ws")}?${params.toString()}`;
  }

  function open() {
    opts.onStatus("connecting");
    ws = new WebSocket(buildUrl());

    ws.addEventListener("open", () => {
      attempt = 0;
      lastFrameAt = Date.now();
      opts.onStatus("open");
      // heartbeat
      if (pingTimer) window.clearInterval(pingTimer);
      pingTimer = window.setInterval(() => {
        send({ type: "ping" });
      }, PING_INTERVAL_MS);
      // half-dead detector — if no frames arrive within the timeout
      // window, the underlying TCP/TLS link is probably dead in a way
      // that won't fire `close`. Force-close to trigger reconnect.
      if (watchdog) window.clearInterval(watchdog);
      watchdog = window.setInterval(() => {
        if (!ws) return;
        if (Date.now() - lastFrameAt > SILENCE_TIMEOUT_MS) {
          try {
            ws.close();
          } catch {
            // ignore — close handler will trigger reconnect
          }
        }
      }, 5_000);
    });

    ws.addEventListener("message", (ev) => {
      lastFrameAt = Date.now();
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
      if (watchdog) {
        window.clearInterval(watchdog);
        watchdog = null;
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
    if (watchdog) {
      window.clearInterval(watchdog);
      watchdog = null;
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
