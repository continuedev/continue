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
        "spin-slow": "spin 6s linear infinite",
      },
      colors: {
        // All vscode variables https://gist.github.com/estruyf/ba49203e1a7d6868e9320a4ea480c27a
        // Examples for vscode https://github.com/githubocto/tailwind-vscode/blob/main/index.js
        "vsc-input-background": "var(--vscode-input-background, rgb(45 45 45))",
        "vsc-background": "var(--vscode-sideBar-background, rgb(30 30 30))",
        "vsc-foreground": "var(--vscode-editor-foreground, #fff)",
        "vsc-button-foreground": "var(--vscode-button-foreground, #ffffff)",
        "vsc-editor-background":
          "var(--vscode-editor-background, var(--vscode-sideBar-background, rgb(30 30 30)))",
        "vsc-list-active-background":
          "var(--vscode-list-activeSelectionBackground, #1bbe84)",
        "vsc-list-active-foreground":
          "var(--vscode-quickInputList-focusForeground, var(--vscode-editor-foreground))",
        "vsc-input-border": "var(--vscode-input-border, #999998)",
        "vsc-find-match":
          "var(--vscode-editor-findMatchBackground, rgba(255, 255, 0, 0.6))",
        "vsc-find-match-selected":
          "var(--vscode-editor-findMatchHighlightBackground, rgba(255, 223, 0, 0.8))",
        description: "var(--vscode-foreground-muted, #999)",

        error: "var(--vscode-errorBackground, #f00)",
        "error-foreground": "var(--vscode-errorForeground, #fff)",
        border: "var(--vscode-sideBar-border, #999998)",
        description: "var(--vscode-descriptionForeground, #999)",
        success: "var(--vscode-testing-iconPassed, #1bbe84)",
        warning: "var(--vscode-list-warningForeground, #ffab00)",
        hover: "var(vscode-list-hoverBackground, #ffffff)",

        // Removed these because unused for now and theming is sensitive

        // "vsc-input-placeholder-foreground":
        // "var(--vscode-input-placeholderForeground, #999)",
        // "vsc-description-foreground": "var(--vscode-descriptionForeground, #999)",
        // "vsc-focus-border": "var(--vscode-focus-border, #1bbe84)",
        // "vsc-sidebar-border": "var(--vscode-sideBar-border, transparent)",
        // "vsc-quick-input-background":
        // "var(--vscode-quickInput-background, var(--vscode-input-background, rgb(45 45 45)))",
        // "vsc-input-border-focus": "var(--vscode-focusBorder, #999998)",
        // "vsc-button-background": "var(--vscode-button-background, #1bbe84)",
        // "vsc-badge-background": "var(--vscode-badge-background, #1bbe84)",
        // "vsc-badge-foreground": "var(--vscode-badge-foreground, #fff)",
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
