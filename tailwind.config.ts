import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        hand: ["var(--font-hand)", "cursive"],
      },
      colors: {
        cream: "#f8f1df",
        paper: "#fff8fb",
        ink: "#09070c",
        muted: "#6e6170",
        hotpink: "#ff2fbf",
        fuchsia: "#ec35d6",
        magenta: "#ff6ad5",
        cyan: "#28d9f2",
        aqua: "#72eadf",
        peach: "#ffc4a3",
        orange: "#ffd2a1",
        violet: "#8f62ff",
        sky: "#28d9f2",
        sage: "#72eadf",
        coral: "#ff2fbf",
        lilac: "#B68CF0",
        butter: "#ffd2a1",
        brand: {
          50: "#fff8fb",
          100: "#ffe4f7",
          500: "#ff2fbf",
          600: "#ec35d6",
          700: "#b7149c",
        },
      },
      boxShadow: {
        soft: "0 18px 52px -34px rgba(9,7,12,0.58)",
        card: "0 18px 48px -34px rgba(9,7,12,0.48)",
        sticker: "0 6px 0 rgba(255,255,255,0.22), 0 18px 44px -30px rgba(9,7,12,0.42)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.9)" },
          "60%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease both",
        pop: "pop 0.25s ease",
      },
    },
  },
  plugins: [],
};

export default config;
