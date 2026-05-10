import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        muted: "#667085",
        line: "#d9dee8",
        panel: "#f7f9fc",
        accent: "#0a8f2c",
        rdcGreen: "#008a2e"
      }
    }
  },
  plugins: []
};

export default config;
