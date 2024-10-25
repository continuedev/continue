/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Note that these breakpoints are primarily optimized for the input toolbar
    screens: {
      "2xs": "170px", // Smallest width for Primary Sidebar in VS Code
      xs: "250px", // Avg default sidebar width in VS Code
      sm: "330px",
      md: "460px",
      lg: "590px",
      xl: "720px",
      "2xl": "860px",
      "3xl": "1000px",
      "4xl": "1180px",
    },
    extend: {
      animation: {
        "spin-slow": "spin 10s linear infinite",
      },
      colors: {
        "vsc-background": "rgb(var(--vsc-background) / <alpha-value>)",
        "secondary-dark": "rgb(var(--secondary-dark) / <alpha-value>)",
        "vsc-input-background": "var(--vscode-input-background, rgb(45 45 45))",
        "vsc-quick-input-background":
          "var(--vscode-quickInput-background, var(--vscode-input-background, rgb(45 45 45)))",
        "vsc-background": "var(--vscode-sideBar-background, rgb(30 30 30))",
        "vsc-foreground": "var(--vscode-editor-foreground, #fff)",
        "vsc-button-background": "var(--vscode-button-background, #1bbe84)",
        "vsc-button-foreground": "var(--vscode-button-foreground, #ffffff)",
        "vsc-editor-background":
          "var(--vscode-editor-background, var(--vscode-sideBar-background, rgb(30 30 30)))",
        "vsc-list-active-background":
          "var(--vscode-list-activeSelectionBackground, #1bbe84)",
        "vsc-focus-border": "var(--vscode-focus-border, #1bbe84)",
        "vsc-list-active-foreground":
          "var(--vscode-quickInputList-focusForeground, var(--vscode-editor-foreground))",
        "vsc-input-border": "var(--vscode-input-border, #999998)",
        "vsc-input-border-focus": "var(--vscode-focusBorder, #999998)",
        "vsc-badge-background": "var(--vscode-badge-background, #1bbe84)",
        "vsc-badge-foreground": "var(--vscode-badge-foreground, #fff)",
        "vsc-sidebar-border": "var(--vscode-sideBar-border, transparent)",
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
