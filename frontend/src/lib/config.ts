// Resolves the backend base URL across dev and prod.
//
// Resolution order:
//   1. VITE_BACKEND_URL env var (build-time, if Cloudflare Pages picks it up)
//   2. Hardcoded production fallback when running on a non-localhost host
//      (e.g. *.pages.dev). Keeps deployment working even if the env var
//      doesn't get injected.
//   3. Empty string in dev → relative paths go through Vite's proxy.

const PROD_BACKEND_URL = "https://attrax-backend.onrender.com";

function resolveBackendBase(): string {
  const env = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");
  if (env) return env;
  // Browser-side fallback: any non-localhost host → assume prod backend
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1" || h.startsWith("192.168.") || h.endsWith(".local");
    if (!isLocal) return PROD_BACKEND_URL;
  }
  return "";
}

const RAW = resolveBackendBase();

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
