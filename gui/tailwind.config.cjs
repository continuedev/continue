/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      "vsc-background": "rgb(var(--vsc-background) / <alpha-value>)",
      "secondary-dark": "rgb(var(--secondary-dark) / <alpha-value>)",
    },
    colors: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      button: {
        DEFAULT: "var(--button-background)",
        foreground: "var(--button-foreground)",
        hover: "var(--button-hover-background)",
      },
      input: {
        DEFAULT: "var(--input-background)",
        foreground: "var(--input-foreground)",
        border: "var(--input-border)",
      },
      dropdown: {
        DEFAULT: "var(--dropdown-background)",
        foreground: "var(--dropdown-foreground)",
      },
      list: {
        activeSelection: {
          background: "var(--list-active-selection-background)",
          foreground: "var(--list-active-selection-foreground)",
        },
        hoverBackground: "var(--list-hover-background)",
      },
      sidebar: {
        background: "var(--sidebar-background)",
      },
      statusbar: {
        background: "var(--statusbar-background)",
        foreground: "var(--statusbar-foreground)",
      },
      tab: {
        activeBackground: "var(--tab-active-background)",
        activeForeground: "var(--tab-active-foreground)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
  corePlugins: {
    preflight: false,
  },
};
