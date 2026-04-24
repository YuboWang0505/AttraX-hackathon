import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

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
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/ws": { target: "ws://localhost:3000", ws: true },
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
