/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        attrax: {
          // Original token names (dark theme, orange accent)
          bg: "#0a0a0a",
          panel: "#15151f",
          text: "#f5f5fa",
          muted: "#8e8ea6",
          accent: "#f07a3a",
          accent2: "#ff6b3a",
          danger: "#ef4444",
          // Extra tokens kept from the restyle attempt
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
        card: "12px",
        tile: "20px",
        pill: "999px",
      },
      backgroundImage: {
        "attrax-grad": "linear-gradient(135deg, #f07a3a 0%, #ff6b3a 100%)",
      },
    },
  },
  plugins: [],
};
