import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        hand: ["var(--font-hand)", "cursive"],
      },
      colors: {
        cream: "#FBF6EC",
        paper: "#F0E5D2",
        ink: "#2A2722",
        muted: "#857F74",
        // saturated accent palette
        butter: "#FFC93C",
        sky: "#6FC5EC",
        sage: "#6FCB87",
        coral: "#F46B4E",
        lilac: "#B68CF0",
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#f0884f",
          600: "#e2703a",
          700: "#c75b2c",
        },
      },
      boxShadow: {
        soft: "0 6px 24px -8px rgba(60,50,40,0.18)",
        card: "0 2px 10px -2px rgba(60,50,40,0.12)",
        sticker: "0 4px 0 rgba(0,0,0,0.04), 0 8px 20px -10px rgba(60,50,40,0.25)",
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
