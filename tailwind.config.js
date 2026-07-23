/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        app: "#14161A",
        surface: "#1D2024",
        surfaceRaised: "#24282D",
        hair: "#24282D",
        hair2: "#2C3138",
        redSoft: "#3A2124",
        secondary: "#8B9099",
        muted: "#5C6169",
        faint: "#4A4F57",
        strong: "#C3C7CC",
        amber: "#FFB020",
        green: "#34D399",
        red: "#FB5B4E",
      },
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
