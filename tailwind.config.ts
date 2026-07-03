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
        cream: "#fdf6f2",
        paper: "#fff8fb",
        ink: "#09070c",
        muted: "#6e6170",
        hotpink: "#ee4fb3",
        fuchsia: "#e845ad",
        magenta: "#f584c3",
        cyan: "#7ec4ec",
        aqua: "#8fdcc9",
        peach: "#f9c8c2",
        orange: "#f9d3cb",
        violet: "#8f62ff",
        sky: "#7ec4ec",
        sage: "#8fdcc9",
        coral: "#ee4fb3",
        lilac: "#B68CF0",
        butter: "#f9d3cb",
        brand: {
          50: "#fff8fb",
          100: "#fde3f3",
          500: "#ee4fb3",
          600: "#e845ad",
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
        wiggle: {
          "0%,100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-7deg)" },
          "75%": { transform: "rotate(7deg)" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 0.28s cubic-bezier(0.24, 1.4, 0.36, 1)",
        wiggle: "wiggle 0.4s ease",
        "pop-in": "pop-in 0.28s cubic-bezier(0.24, 1.4, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
