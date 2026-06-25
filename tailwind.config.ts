import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        ink: {
          DEFAULT: "#0a0a0a",
          soft: "#161616",
          line: "#262626",
        },
        paper: {
          DEFAULT: "#fafaf8",
          soft: "#f0f0ec",
          line: "#e2e2dc",
        },
        accent: {
          DEFAULT: "#ff4d2e",
          soft: "#ff7a5e",
        },
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};

export default config;
