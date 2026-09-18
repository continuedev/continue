// All vscode variables https://gist.github.com/estruyf/ba49203e1a7d6868e9320a4ea480c27a
// Examples for vscode https://github.com/githubocto/tailwind-vscode/blob/main/index.js

// Ruckus default theme: deep slate surfaces with electric violet accents.
// These are fallbacks only — when the host IDE reports a theme, it wins.
export const THEME_COLORS = {
  background: {
    vars: [
      "--vscode-sideBar-background",
      "--vscode-editor-background",
      "--vscode-panel-background",
    ],
    default: "#0f1117", // deep slate
  },
  foreground: {
    vars: [
      "--vscode-sideBar-foreground",
      "--vscode-editor-foreground",
      "--vscode-panel-foreground",
    ],
    default: "#e4e6ed", // soft white
  },
  "editor-background": {
    vars: ["--vscode-editor-background"],
    default: "#0b0d12", // near-black slate
  },
  "editor-foreground": {
    vars: ["--vscode-editor-foreground"],
    default: "#e4e6ed", // soft white
  },
  "primary-background": {
    vars: ["--vscode-button-background"],
    default: "#7c5cff", // electric violet
  },
  "primary-foreground": {
    vars: ["--vscode-button-foreground"],
    default: "#ffffff", // white
  },
  "primary-hover": {
    vars: ["--vscode-button-hoverBackground"],
    default: "#8f73ff", // lifted violet
  },
  "secondary-background": {
    vars: ["--vscode-button-secondaryBackground"],
    default: "#1a1d27", // raised slate
  },
  "secondary-foreground": {
    vars: ["--vscode-button-secondaryForeground"],
    default: "#d7dae5", // muted white
  },
  "secondary-hover": {
    vars: ["--vscode-button-secondaryHoverBackground"],
    default: "#232733", // hover slate
  },
  border: {
    vars: ["--vscode-sideBar-border", "--vscode-panel-border"],
    default: "#232733", // hairline slate
  },
  "border-focus": {
    vars: ["--vscode-focusBorder"],
    default: "#7c5cff", // electric violet
  },
  // Command styles are used for tip-tap editor
  "command-background": {
    vars: ["--vscode-commandCenter-background"],
    default: "#141721", // sunken slate
  },
  "command-foreground": {
    vars: ["--vscode-commandCenter-foreground"],
    default: "#e4e6ed", // soft white
  },
  "command-border": {
    vars: ["--vscode-commandCenter-inactiveBorder"],
    default: "#272b38", // subtle slate
  },
  "command-border-focus": {
    vars: ["--vscode-commandCenter-activeBorder"],
    default: "#7c5cff", // electric violet
  },
  description: {
    vars: ["--vscode-descriptionForeground"],
    default: "#9aa1b5", // cool gray
  },
  "description-muted": {
    vars: ["--vscode-list-deemphasizedForeground"],
    default: "#6b7285", // dim slate gray
  },
  "input-background": {
    vars: ["--vscode-input-background"],
    default: "#141721", // sunken slate
  },
  "input-foreground": {
    vars: ["--vscode-input-foreground"],
    default: "#e4e6ed", // soft white
  },
  "input-border": {
    vars: [
      "--vscode-input-border",
      "--vscode-commandCenter-inactiveBorder",
      "vscode-border",
    ],
    default: "#272b38", // subtle slate
  },
  "input-placeholder": {
    vars: ["--vscode-input-placeholderForeground"],
    default: "#6b7285", // dim slate gray
  },
  "table-oddRow": {
    vars: ["--vscode-tree-tableOddRowsBackground"],
    default: "#141721", // sunken slate
  },
  "badge-background": {
    vars: ["--vscode-badge-background"],
    default: "#2a2f3f", // elevated slate
  },
  "badge-foreground": {
    vars: ["--vscode-badge-foreground"],
    default: "#e4e6ed", // soft white
  },
  info: {
    vars: [
      "--vscode-charts-blue",
      "--vscode-notebookStatusRunningIcon-foreground",
    ],
    default: "#5b9dff", // azure
  },
  success: {
    vars: [
      "--vscode-notebookStatusSuccessIcon-foreground",
      "--vscode-testing-iconPassed",
      "--vscode-gitDecoration-addedResourceForeground",
      "--vscode-charts-green",
    ],
    default: "#3ddc97", // mint
  },
  warning: {
    vars: [
      "--vscode-editorWarning-foreground",
      "--vscode-list-warningForeground",
    ],
    default: "#ffb454", // amber
  },
  error: {
    vars: ["--vscode-editorError-foreground", "--vscode-list-errorForeground"],
    default: "#ff5c6c", // coral
  },
  link: {
    vars: ["--vscode-textLink-foreground"],
    default: "#a78bfa", // light violet
  },
  terminal: {
    vars: ["--vscode-terminal-ansiGreen"],
    default: "#3ddc97", // mint
  },
  textCodeBlockBackground: {
    vars: ["--vscode-textCodeBlock-background"],
    default: "#141721", // sunken slate
  },
  accent: {
    vars: ["--vscode-tab-activeBorderTop", "--vscode-focusBorder"],
    default: "#7c5cff", // electric violet
  },
  "find-match": {
    vars: ["--vscode-editor-findMatchBackground"], // Can't get "var(--vscode-editor-findMatchBackground, rgba(237, 18, 146, 0.5))" to work
    default: "#7c5cff40", // translucent violet
  },
  "find-match-selected": {
    vars: ["--vscode-editor-findMatchHighlightBackground"],
    default: "#a78bfa50", // translucent light violet
  },
  "list-hover": {
    // --vscode-tab-hoverBackground
    vars: ["--vscode-list-hoverBackground"],
    default: "#1a1d27", // raised slate
  },
  "list-active": {
    vars: ["--vscode-list-activeSelectionBackground"],
    default: "#7c5cff33", // translucent violet
  },
  "list-active-foreground": {
    vars: ["--vscode-list-activeSelectionForeground"],
    default: "#ffffff", // white
  },
};

// TODO: add fonts - GUI fonts in jetbrains differ from IDE:
// --vscode-editor-font-family;
// --vscode-font-family;
export const THEME_CSS_VARS = Object.values(THEME_COLORS)
  .map((value) => value.vars)
  .flat();

export const THEME_CSS_VAR_DEFAULTS = Object.entries(THEME_COLORS).reduce(
  (acc, [_, value]) => {
    value.vars.forEach((varName) => {
      acc[varName] = value.default;
    });
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

// Generates recursive CSS variable fallback for a given color name
// e.g. var(--vscode-button-background, var(--vscode-button-foreground, #ffffff))
export const getRecursiveVar = (vars: string[], defaultColor: string) => {
  return [...vars].reverse().reduce((curr, varName) => {
    return `var(${varName}, ${curr})`;
  }, defaultColor);
};

export const varWithFallback = (colorName: keyof typeof THEME_COLORS) => {
  const themeVals = THEME_COLORS[colorName];
  if (!themeVals) {
    throw new Error(`Invalid theme color name ${colorName}`);
  }
  return getRecursiveVar(themeVals.vars, themeVals.default);
};

export const setDocumentStylesFromTheme = (
  theme: Record<string, string | undefined | null>,
) => {
  // Check for extraneous theme items
  Object.entries(theme).forEach(([colorName, value]) => {
    const themeVals = THEME_COLORS[colorName as keyof typeof THEME_COLORS];
    if (!themeVals) {
      console.warn(
        `Receieved theme color ${colorName} which is not used by the theme`,
      );
      return;
    }
  });

  // Write theme values to document
  const missingColors: string[] = [];
  Object.entries(THEME_COLORS).forEach(([colorName, settings]) => {
    let colorVal = settings.default;
    const newColor = theme[colorName];
    if (newColor) {
      colorVal = newColor;
      // Remove alpha channel from all hex colors (seems to cause bad colors)
      if (newColor.startsWith("#") && newColor.length > 7) {
        colorVal = colorVal.slice(0, 7);
      }
    } else {
      missingColors.push(colorName);
      // console.warn(
      //   `Missing theme color: ${colorName}. Falling back to default ${colorVal}`,
      // );
    }

    localStorage.setItem(colorName, colorVal);
    for (const cssVar of settings.vars) {
      document.body.style.setProperty(cssVar, colorVal);
      document.documentElement.style.setProperty(cssVar, colorVal);
    }
  });

  return missingColors;
};

export const setDocumentStylesFromLocalStorage = (checkCache: boolean) => {
  for (const [colorName, themeVals] of Object.entries(THEME_COLORS)) {
    for (const cssVar of themeVals.vars) {
      // Get cached values (for non-vscode IDEs)
      if (checkCache) {
        const cached = localStorage.getItem(colorName);
        if (cached) {
          document.body.style.setProperty(cssVar, cached);
        }
      }
    }
  }
};

export const clearThemeLocalCache = () => {
  for (const colorName of Object.keys(THEME_COLORS)) {
    localStorage.removeItem(colorName);
  }
};
