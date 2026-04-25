// Resolves the backend base URL across dev and prod.
//
// Dev: VITE_BACKEND_URL is unset → relative paths "/api/..." and "/ws" go
// through the Vite proxy in vite.config.ts to localhost:3001.
//
// Prod (Cloudflare Pages frontend → Render backend): set VITE_BACKEND_URL
// to e.g. "https://attrax-backend.onrender.com" at build time. Both HTTP
// and WS URLs derive from this single value.

const RAW = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");

export function backendUrl(path: string): string {
  return `${RAW}${path}`;
}

export function backendWsUrl(path: string): string {
  if (!RAW) {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${window.location.host}${path}`;
  }
  return RAW.replace(/^http/, "ws") + path;
}
