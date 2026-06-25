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
        cream: "#F4F0FA",
        paper: "#ECE7F5",
        ink: "#211F2A",
        muted: "#6B6675",
        // single scheme: violet / pink / blue
        violet: "#7E5BD9",
        sky: "#8FB6EF",
        sage: "#4F86D6", // info/success (blue)
        coral: "#D6519E", // alerts/destructive (pink)
        lilac: "#B68CF0",
        butter: "#C49EE8", // legacy name, kept in-scheme
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
