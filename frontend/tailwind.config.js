/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        attrax: {
          bg: "#0a0a0f",
          panel: "#15151f",
          text: "#f5f5fa",
          muted: "#8e8ea6",
          accent: "#b84cff",
          accent2: "#ff4c8c",
          danger: "#ff4c5c",
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
      backgroundImage: {
        "attrax-grad": "linear-gradient(135deg, #b84cff 0%, #ff4c8c 100%)",
      },
      borderRadius: {
        card: "12px",
        btn: "8px",
        bubble: "24px",
      },
    },
  },
  plugins: [],
};
