/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy attrax tokens (kept for Login/BtGate/shared components)
        attrax: {
          bg: "#0a0a0a",
          panel: "#15151f",
          text: "#f5f5fa",
          muted: "#8e8ea6",
          accent: "#f07a3a",
          accent2: "#ff6b3a",
          danger: "#ef4444",
          black: "#0a0a0a",
          "panel-soft": "#2a2a2a",
          "accent-dark": "#d65f21",
          chat: "#f6f7fa",
          "chat-text": "#1a1a1a",
          "chat-muted": "#8e8e93",
          bubble: "#ffffff",
          "bubble-border": "rgba(0,0,0,0.05)",
          ok: "#22c55e",
          warn: "#f59e0b",
        },
        // UI.md design tokens
        ink: {
          900: "#0A0A0A",
          800: "#1C1C1E",
          700: "#3A3A3C",
          500: "#8E8E93",
          300: "#D1D1D6",
          100: "#F2F2F7",
        },
        paper: "#FFFFFF",
        "accent-500": "#F07A3A",
        "accent-600": "#D65F21",
        "accent-300": "#F5A98C",
        danger: "#EF4444",
        ok: "#22C55E",
        warn: "#F59E0B",
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
        btn: "8px",
        bubble: "24px",
        card: "20px",
        tile: "16px",
        pill: "9999px",
        sheet: "28px",
      },
      backgroundImage: {
        "attrax-grad": "linear-gradient(135deg, #f07a3a 0%, #ff6b3a 100%)",
        "grad-cool":
          "radial-gradient(120% 80% at 20% 10%, #E5ECF5 0%, transparent 60%)," +
          "radial-gradient(100% 70% at 80% 30%, #C6D3ED 0%, transparent 60%)," +
          "radial-gradient(120% 80% at 50% 90%, #A9BEE1 0%, transparent 70%)",
        "grad-warm":
          "radial-gradient(120% 80% at 30% 20%, #FBE5D6 0%, transparent 60%)," +
          "radial-gradient(100% 70% at 75% 50%, #F5B089 0%, transparent 60%)," +
          "radial-gradient(130% 90% at 50% 100%, #F07A3A 0%, transparent 70%)",
        "grad-fever":
          "radial-gradient(100% 70% at 30% 20%, #F5A98C 0%, transparent 60%)," +
          "radial-gradient(110% 80% at 70% 60%, #F07A3A 0%, transparent 60%)," +
          "radial-gradient(130% 90% at 50% 100%, #C73E6E 0%, transparent 70%)",
      },
      boxShadow: {
        bubble: "0 1px 2px rgba(0,0,0,0.04)",
        card: "0 8px 32px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
