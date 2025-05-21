// All vscode variables https://gist.github.com/estruyf/ba49203e1a7d6868e9320a4ea480c27a
// Examples for vscode https://github.com/githubocto/tailwind-vscode/blob/main/index.js

// The current default theme is dark with blue accents
export const THEME_COLORS = {
  background: {
    var: "--vscode-sideBar-background",
    default: "#1e1e1e", // dark gray
  },
  foreground: {
    var: "--vscode-sideBar-foreground", // --vscode-editor-foreground
    default: "#e6e6e6", // light gray
  },
  "editor-background": {
    var: "--vscode-editor-background",
    default: "#1e1e1e", // dark gray
  },
  "editor-foreground": {
    var: "--vscode-editor-foreground",
    default: "#e6e6e6", // light gray
  },
  "primary-background": {
    var: "--vscode-button-background",
    default: "#2c5aa0", // medium blue
  },
  "primary-foreground": {
    var: "--vscode-button-foreground",
    default: "#ffffff", // white
  },
  "primary-hover": {
    var: "--vscode-button-hoverBackground",
    default: "#3a6db3", // lighter blue
  },
  "secondary-background": {
    var: "--vscode-button-secondaryBackground",
    default: "#303030", // medium dark gray
  },
  "secondary-foreground": {
    var: "--vscode-button-secondaryForeground",
    default: "#e6e6e6", // light gray
  },
  "secondary-hover": {
    var: "--vscode-button-secondaryHoverBackground",
    default: "#3a3a3a", // medium gray
  },
  border: {
    // --vscode-panel-border
    var: "--vscode-sideBar-border",
    default: "#2a2a2a", // dark gray border
  },
  "border-focus": {
    var: "--vscode-focusBorder",
    default: "#3a6db3", // lighter blue
  },
  // Command styles are used for tip-tap editor
  "command-background": {
    var: "--vscode-commandCenter-background",
    default: "#252525", // dark gray
  },
  "command-foreground": {
    var: "--vscode-commandCenter-foreground",
    default: "#e6e6e6", // light gray
  },
  "command-border": {
    var: "--vscode-commandCenter-inactiveBorder",
    default: "#555555", // medium gray
  },
  "command-border-focus": {
    var: "--vscode-commandCenter-activeBorder",
    default: "#4d8bf0", // bright blue
  },
  description: {
    var: "--vscode-descriptionForeground",
    default: "#b3b3b3", // medium light gray
  },
  "description-muted": {
    var: "--vscode-list-deemphasizedForeground",
    default: "#8c8c8c", // medium gray
  },
  "input-background": {
    var: "--vscode-input-background",
    default: "#2d2d2d", // dark gray
  },
  "input-foreground": {
    var: "--vscode-input-foreground",
    default: "#e6e6e6", // light gray
  },
  "input-border": {
    var: "--vscode-input-border",
    default: "#555555", // medium gray
  },
  "input-placeholder": {
    var: "--vscode-input-placeholderForeground",
    default: "#9e9e9e", // medium light gray
  },
  "table-oddRow": {
    var: "--vscode-tree-tableOddRowsBackground",
    default: "#2d2d2d", // dark gray
  },
  "badge-background": {
    var: "--vscode-badge-background",
    default: "#4d4d4d", // medium dark gray
  },
  "badge-foreground": {
    var: "--vscode-badge-foreground",
    default: "#ffffff", // white
  },
  success: {
    var: "--vscode-notebookStatusSuccessIcon-foreground", // "var(--vscode-testing-iconPassed, #1bbe84)" // --vscode-charts-green
    default: "#4caf50", // green
  },
  warning: {
    var: "--vscode-editorWarning-foreground", // --vscode-list-warningForeground
    default: "#ffb74d", // amber/yellow
  },
  error: {
    var: "--vscode-editorError-foreground", // --vscode-list-errorForeground
    default: "#f44336", // red
  },
  link: {
    var: "--vscode-textLink-foreground",
    default: "#5c9ce6", // medium blue
  },
  accent: {
    var: "--vscode-tab-activeBorderTop",
    default: "#4d8bf0", // bright blue
  },
  "find-match": {
    var: "--vscode-editor-findMatchBackground", // Can't get "var(--vscode-editor-findMatchBackground, rgba(237, 18, 146, 0.5))" to work
    default: "#264f7840", // translucent blue
  },
  "find-match-selected": {
    var: "--vscode-editor-findMatchHighlightBackground",
    default: "#ffb74d40", // translucent amber
  },
  "list-hover": {
    // --vscode-tab-hoverBackground
    var: "--vscode-list-hoverBackground",
    default: "#383838", // medium dark gray
  },
  "list-active": {
    var: "--vscode-list-activeSelectionBackground",
    default: "#2c5aa050", // translucent medium blue
  },
  "list-active-foreground": {
    var: "--vscode-list-activeSelectionForeground",
    default: "#ffffff", // white
  },
};

// TODO: add fonts - GUI fonts in jetbrains differ from IDE:
// --vscode-editor-font-family;
// --vscode-font-family;

export const THEME_CSS_VARS = Object.values(THEME_COLORS).map(
  (value) => value.var,
);

export const THEME_CSS_VAR_DEFAULTS = Object.entries(THEME_COLORS).reduce(
  (acc, [_, value]) => {
    acc[value.var] = value.default;
    return acc;
  },
  {} as Record<string, string>,
);

export const THEME_DEFAULTS = Object.entries(THEME_COLORS).reduce(
  (acc, [key, value]) => {
    acc[key] = value.default;
    return acc;
  },
  {} as Record<string, string>,
);

export const varWithFallback = (className: keyof typeof THEME_COLORS) =>
  `var(${THEME_COLORS[className].var}, ${THEME_COLORS[className].default})`;

export const setDocumentStylesFromTheme = (
  theme: Record<string, string | undefined | null>,
) => {
  // Check for missing theme items
  const themeKeys = Object.keys(THEME_COLORS);
  const missingKeys = themeKeys.filter(
    (key) => !Object.keys(theme).includes(key),
  );
  if (missingKeys.length > 0) {
    console.warn(
      `Missing theme keys: ${missingKeys.join(", ")}. Please check theme`,
    );
  }
  // Write each theme color to the document
  Object.entries(theme).forEach(([colorName, value]) => {
    if (value) {
      const cssVarName =
        THEME_COLORS[colorName as keyof typeof THEME_COLORS]?.var;
      // TODO VALUE WITHOUT ALPHA CHANNEL
      document.body.style.setProperty(cssVarName, value);
      document.documentElement.style.setProperty(cssVarName, value);
      localStorage.setItem(colorName, value);
    } else {
      console.warn(
        `Theme color ${colorName} is undefined or null. Please check theme. Falling back to defaults.`,
      );
    }
  });

  // Cache values in local storage
  for (const [colorName, themeVals] of Object.entries(THEME_COLORS)) {
    const currentVal = document.body.style.getPropertyValue(themeVals.var);
    if (currentVal) {
      localStorage.setItem(colorName, currentVal);
    }
  }
};

export const setDocumentStylesFromLocalStorage = (checkCache: boolean) => {
  for (const [colorName, themeVals] of Object.entries(THEME_COLORS)) {
    const cssVarName = themeVals.var;

    // Get cached values (for non-vscode IDEs)
    if (checkCache) {
      const cached = localStorage.getItem(colorName);
      if (cached) {
        document.body.style.setProperty(cssVarName, cached);
      }
    }

    // Remove alpha channel from all hex colors besides ones that are expected to have it
    if (!colorName.includes("find-match")) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(
        cssVarName,
      );
      if (value.startsWith("#") && value.length > 7) {
        document.body.style.setProperty(cssVarName, value.slice(0, 7));
      }
    }
  }
};

export const clearThemeLocalCache = () => {
  for (const colorName of Object.keys(THEME_COLORS)) {
    localStorage.removeItem(colorName);
  }
};
