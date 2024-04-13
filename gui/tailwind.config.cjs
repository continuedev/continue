/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
    colors: {
      "vsc-background": "rgb(var(--vsc-background) / <alpha-value>)",
      "secondary-dark": "rgb(var(--secondary-dark) / <alpha-value>)",
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
