import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Worktree-only override: backend on :3001, frontend on :5174.
// Lets this main-branch worktree run side-by-side with the
// voice-call-stt-exp checkout that owns :3000 / :5173.
export default defineConfig({
  // Compile-time replacement: any bare `global` identifier in source becomes
  // `globalThis`. Needed because simple-peer's randombytes dependency refs
  // `global` at module-top level, and pre-bundled deps load BEFORE the
  // polyfill plugin's runtime shim runs — so without this define, init
  // crashes with "global is not defined" and the page goes blank.
  define: {
    global: "globalThis",
  },
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  server: {
    port: 5174,
    // Bind on both IPv4 + IPv6 (Windows Chrome prefers 127.0.0.1 and won't
    // fall back to ::1 if that fails — without this you get
    // ERR_CONNECTION_REFUSED on http://localhost:5174 even though the
    // server is up).
    host: true,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
  optimizeDeps: {
    // Force re-pre-bundle simple-peer against the new `define`
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});
