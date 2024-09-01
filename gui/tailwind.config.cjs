/** @type {import('tailwindcss').Config} */
const colors = require("tailwindcss/colors");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
    colors: {
      ...colors, // This spreads all default Tailwind colors
      "vsc-background": "rgb(var(--vsc-background) / <alpha-value>)",
      "secondary-dark": "rgb(var(--secondary-dark) / <alpha-value>)",
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
