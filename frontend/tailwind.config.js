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
        // UI.md design tokens (values from 原版 column)
        // bg-stage — pure black scene background (Login / BtGate / dark inputs)
        stage: "#000000",
        // text / surface inks
        ink: {
          900: "#1A1A1A", // text-on-light
          800: "#1C1C1E", // dark card bg (iOS-style)
          700: "#3F3F3F", // surface-dark (list containers)
          500: "#9A9A9A", // text-muted
          300: "#D1D1D6", // light dividers
          100: "#F2F2F7",
        },
        // surface-light
        paper: "#FFFFFF",
        // brand-primary — orange CTA
        "accent-500": "#F08A3E",
        "accent-600": "#D77027", // hover/pressed
        "accent-300": "#F5A98C",
        // semantic
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
        card: "24px", // UI.md radius-card
        tile: "16px",
        pill: "999px", // UI.md radius-pill
        sheet: "28px",
      },
      backgroundImage: {
        "attrax-grad": "linear-gradient(135deg, #F08A3E 0%, #ff6b3a 100%)",
        // UI.md bg-haze: 浅蓝粉橙径向渐变 (light scene page bg)
        haze:
          "radial-gradient(100% 70% at 15% 20%, #DDE6F2 0%, transparent 60%)," +
          "radial-gradient(110% 70% at 85% 40%, #F4CEDD 0%, transparent 60%)," +
          "radial-gradient(120% 80% at 50% 95%, #F9D6B3 0%, transparent 70%)",
        // UI.md gradient-hero: radial warm halo for splash/brand moments
        "gradient-hero":
          "radial-gradient(80% 60% at 50% 50%, #F08A3E 0%, transparent 55%)," +
          "radial-gradient(100% 80% at 60% 40%, #E4A5F0 0%, transparent 65%)",
      },
      boxShadow: {
        bubble: "0 1px 2px rgba(0,0,0,0.04)",
        card: "0 8px 32px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
