/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xxs: "170px", // Smallest width for Primary Sidebar in VS Code
      xs: "250px", // Default sidebar width in VS Code
      sm: "320px",
      md: "480px",
      lg: "640px", // Tailwind's default 'sm'
      xl: "768px", // Tailwind's default 'md'
      "2xl": "1024px", // Tailwind's default 'lg'
    },
    extend: {
      animation: {
        "spin-slow": "spin 30s linear infinite",
      },
      colors: {
        "vsc-background": "rgb(var(--vsc-background) / <alpha-value>)",
        "secondary-dark": "rgb(var(--secondary-dark) / <alpha-value>)",
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
