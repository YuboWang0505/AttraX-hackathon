/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        attrax: {
          // Control-screen palette (Login, BtGate)
          black: "#0a0a0a",
          panel: "#1a1a1a",
          "panel-soft": "#2a2a2a",
          // Accent
          accent: "#f07a3a",
          "accent-dark": "#d65f21",
          // Chat-screen palette
          chat: "#f6f7fa",
          "chat-text": "#1a1a1a",
          "chat-muted": "#8e8e93",
          bubble: "#ffffff",
          "bubble-border": "rgba(0,0,0,0.05)",
          // Semantic
          danger: "#ef4444",
          warn: "#f59e0b",
          ok: "#22c55e",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      borderRadius: {
        pill: "999px",
        card: "24px",
        tile: "20px",
      },
      backgroundImage: {
        "splash-grad":
          "radial-gradient(ellipse 80% 60% at 50% 50%, #e4a0f0 0%, #f5a8b6 45%, #f5b58a 100%)",
      },
    },
  },
  plugins: [],
};
