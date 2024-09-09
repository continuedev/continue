/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "vsc-background": "rgb(var(--vsc-background) / <alpha-value>)",
        "secondary-dark": "rgb(var(--secondary-dark) / <alpha-value>)",
      },
      screens: {
        xs: "425px",
        ...defaultTheme.screens,
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
