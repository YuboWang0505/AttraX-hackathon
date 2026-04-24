/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy attrax tokens (kept for backwards-compat on some overlays)
        attrax: {
          bg: "#0a0a0a",
          panel: "#15151f",
          text: "#f5f5fa",
          muted: "#8e8ea6",
          accent: "#FF8832",
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
        stage: "#000000",
        ink: {
          900: "#1A1A1A",
          800: "#1C1C1E",
          700: "#3F3F3F",
          500: "#9A9A9A",
          400: "#988D8D",
          300: "#D1D1D6",
          200: "#E6E6E6",
          100: "#F2F2F7",
        },
        paper: "#FFFFFF",
        // Figma synth palette — aurora orbs & accents
        synth: {
          orange: "#FF8832",
          orange2: "#F66B42",
          peach: "#F4A368",
          peach2: "#FFB97D",
          red: "#E95146",
          pink: "#DD6C86",
          pink2: "#F53777",
          lilac: "#CAC2E6",
          cream: "#EFE6D5",
          sky: "#A2D7F4",
          cyan: "#25D0FB",
          blue: "#0B71F1",
          record: "#E50000",
        },
        "accent-500": "#FF8832",
        "accent-600": "#D77027",
        "accent-300": "#F5A98C",
        danger: "#EF4444",
        ok: "#22C55E",
        warn: "#F59E0B",
      },
      fontFamily: {
        sans: [
          "PingFang SC",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Microsoft YaHei",
          "sans-serif",
        ],
        display: [
          "PingFang SC",
          "SF Pro Display",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      fontWeight: {
        heavy: "900",
      },
      borderRadius: {
        btn: "8px",
        bubble: "24px",
        card: "24px",
        tile: "16px",
        pill: "999px",
        sheet: "28px",
        "pill-xl": "128px",
        modal: "44px",
      },
      backgroundImage: {
        "attrax-grad": "linear-gradient(135deg, #FF8832 0%, #F66B42 100%)",
        haze:
          "radial-gradient(100% 70% at 15% 20%, #DDE6F2 0%, transparent 60%)," +
          "radial-gradient(110% 70% at 85% 40%, #F4CEDD 0%, transparent 60%)," +
          "radial-gradient(120% 80% at 50% 95%, #F9D6B3 0%, transparent 70%)",
        "gradient-hero":
          "radial-gradient(80% 60% at 50% 50%, #FF8832 0%, transparent 55%)," +
          "radial-gradient(100% 80% at 60% 40%, #E4A5F0 0%, transparent 65%)",
      },
      boxShadow: {
        bubble: "0 1px 2px rgba(0,0,0,0.04)",
        card: "0 8px 32px rgba(0,0,0,0.08)",
        dial: "0 4px 66px rgba(79,79,79,0.25)",
        chip: "0 4px 23.8px rgba(164,164,164,0.25)",
        cta: "0 4px 4px rgba(0,0,0,0.25)",
      },
      keyframes: {
        "orb-drift": {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(20px,-30px,0) scale(1.08)" },
        },
        "orb-drift-2": {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(-24px,20px,0) scale(1.05)" },
        },
        "halo-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "record-pulse": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(1.2)" },
        },
      },
      animation: {
        "orb-1": "orb-drift 14s ease-in-out infinite",
        "orb-2": "orb-drift-2 18s ease-in-out infinite",
        "halo-spin": "halo-spin 60s linear infinite",
        "record-pulse": "record-pulse 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
