// All vscode variables https://gist.github.com/estruyf/ba49203e1a7d6868e9320a4ea480c27a
// Examples for vscode https://github.com/githubocto/tailwind-vscode/blob/main/index.js

// The current default theme is dark with blue accents
export const THEME_COLORS_OLD = {
  background: {
    vars: [
      "--vscode-sideBar-background",
      "--vscode-editor-background",
      "--vscode-panel-background",
    ],
    default: "#1e1e1e", // dark gray
  },
  foreground: {
    vars: [
      "--vscode-sideBar-foreground",
      "--vscode-editor-foreground",
      "--vscode-panel-foreground",
    ],
    default: "#e6e6e6", // light gray
  },
  "editor-background": {
    vars: ["--vscode-editor-background"],
    default: "#1e1e1e", // dark gray
  },
  "editor-foreground": {
    vars: ["--vscode-editor-foreground"],
    default: "#e6e6e6", // light gray
  },
  "primary-background": {
    vars: ["--vscode-button-background"],
    default: "#2c5aa0", // medium blue
  },
  "primary-foreground": {
    vars: ["--vscode-button-foreground"],
    default: "#ffffff", // white
  },
  "primary-hover": {
    vars: ["--vscode-button-hoverBackground"],
    default: "#3a6db3", // lighter blue
  },
  "secondary-background": {
    vars: ["--vscode-button-secondaryBackground"],
    default: "#303030", // medium dark gray
  },
  "secondary-foreground": {
    vars: ["--vscode-button-secondaryForeground"],
    default: "#e6e6e6", // light gray
  },
  "secondary-hover": {
    vars: ["--vscode-button-secondaryHoverBackground"],
    default: "#3a3a3a", // medium gray
  },
  border: {
    vars: ["--vscode-sideBar-border", "--vscode-panel-border"],
    default: "#2a2a2a", // dark gray border
  },
  "border-focus": {
    vars: ["--vscode-focusBorder"],
    default: "#3a6db3", // lighter blue
  },
  // Command styles are used for tip-tap editor
  "command-background": {
    vars: ["--vscode-commandCenter-background"],
    default: "#252525", // dark gray
  },
  "command-foreground": {
    vars: ["--vscode-commandCenter-foreground"],
    default: "#e6e6e6", // light gray
  },
  "command-border": {
    vars: ["--vscode-commandCenter-inactiveBorder"],
    default: "#555555", // medium gray
  },
  "command-border-focus": {
    vars: ["--vscode-commandCenter-activeBorder"],
    default: "#4d8bf0", // bright blue
  },
  description: {
    vars: ["--vscode-descriptionForeground"],
    default: "#b3b3b3", // medium light gray
  },
  "description-muted": {
    vars: ["--vscode-list-deemphasizedForeground"],
    default: "#8c8c8c", // medium gray
  },
  "input-background": {
    vars: ["--vscode-input-background"],
    default: "#2d2d2d", // dark gray
  },
  "input-foreground": {
    vars: ["--vscode-input-foreground"],
    default: "#e6e6e6", // light gray
  },
  "input-border": {
    vars: [
      "--vscode-input-border",
      "--vscode-commandCenter-inactiveBorder",
      "vscode-border",
    ],
    default: "#555555", // medium gray
  },
  "input-placeholder": {
    vars: ["--vscode-input-placeholderForeground"],
    default: "#9e9e9e", // medium light gray
  },
  "table-oddRow": {
    vars: ["--vscode-tree-tableOddRowsBackground"],
    default: "#2d2d2d", // dark gray
  },
  "badge-background": {
    vars: ["--vscode-badge-background"],
    default: "#4d4d4d", // medium dark gray
  },
  "badge-foreground": {
    vars: ["--vscode-badge-foreground"],
    default: "#ffffff", // white
  },
  success: {
    vars: [
      "--vscode-notebookStatusSuccessIcon-foreground",
      "--vscode-testing-iconPassed",
      "--vscode-gitDecoration-addedResourceForeground",
      "--vscode-charts-green",
    ],
    default: "#4caf50", // green
  },
  warning: {
    vars: [
      "--vscode-editorWarning-foreground",
      "--vscode-list-warningForeground",
    ],
    default: "#ffb74d", // amber/yellow
  },
  error: {
    vars: ["--vscode-editorError-foreground", "--vscode-list-errorForeground"],
    default: "#f44336", // red
  },
  link: {
    vars: ["--vscode-textLink-foreground"],
    default: "#5c9ce6", // medium blue
  },
  accent: {
    vars: ["--vscode-tab-activeBorderTop", "--vscode-focusBorder"],
    default: "#4d8bf0", // bright blue
  },
  "find-match": {
    vars: ["--vscode-editor-findMatchBackground"], // Can't get "var(--vscode-editor-findMatchBackground, rgba(237, 18, 146, 0.5))" to work
    default: "#264f7840", // translucent blue
  },
  "find-match-selected": {
    vars: ["--vscode-editor-findMatchHighlightBackground"],
    default: "#ffb74d40", // translucent amber
  },
  "list-hover": {
    // --vscode-tab-hoverBackground
    vars: ["--vscode-list-hoverBackground"],
    default: "#383838", // medium dark gray
  },
  "list-active": {
    vars: ["--vscode-list-activeSelectionBackground"],
    default: "#2c5aa050", // translucent medium blue
  },
  "list-active-foreground": {
    vars: ["--vscode-list-activeSelectionForeground"],
    default: "#ffffff", // white
  },
};

export const THEME_COLORS = {
  background: {
    vars: [
      "--vscode-sideBar-background",
      "--vscode-editor-background",
      "--vscode-panel-background",
    ],
    default: "#ffffff", // light gray/white
  },
  foreground: {
    vars: [
      "--vscode-sideBar-foreground",
      "--vscode-editor-foreground",
      "--vscode-panel-foreground",
    ],
    default: "#222222", // dark gray/black for text
  },
  "editor-background": {
    vars: ["--vscode-editor-background"],
    default: "#ffffff", // white
  },
  "editor-foreground": {
    vars: ["--vscode-editor-foreground"],
    default: "#222222", // dark for text
  },
  "primary-background": {
    vars: ["--vscode-button-background"],
    default: "#005FB8", // blue
  },
  "primary-foreground": {
    vars: ["--vscode-button-foreground"],
    default: "#ffffff", // white
  },
  "primary-hover": {
    vars: ["--vscode-button-hoverBackground"],
    default: "#0258A8", // darker blue
  },
  "secondary-background": {
    vars: ["--vscode-button-secondaryBackground"],
    default: "#E5E5E5", // very light gray
  },
  "secondary-foreground": {
    vars: ["--vscode-button-secondaryForeground"],
    default: "#3B3B3B", // dark gray text
  },
  "secondary-hover": {
    vars: ["--vscode-button-secondaryHoverBackground"],
    default: "#CCCCCC", // light gray
  },
  border: {
    vars: ["--vscode-sideBar-border", "--vscode-panel-border"],
    default: "#CECECE", // light border
  },
  "border-focus": {
    vars: ["--vscode-focusBorder"],
    default: "#005FB8", // blue
  },
  // Command styles are used for tip-tap editor
  "command-background": {
    vars: ["--vscode-commandCenter-background"],
    default: "#F8F8F8", // very light gray
  },
  "command-foreground": {
    vars: ["--vscode-commandCenter-foreground"],
    default: "#3B3B3B", // dark text
  },
  "command-border": {
    vars: ["--vscode-commandCenter-inactiveBorder"],
    default: "#CECECE", // light border
  },
  "command-border-focus": {
    vars: ["--vscode-commandCenter-activeBorder"],
    default: "#005FB8", // blue
  },
  description: {
    vars: ["--vscode-descriptionForeground"],
    default: "#3B3B3B", // dark gray
  },
  "description-muted": {
    vars: ["--vscode-list-deemphasizedForeground"],
    default: "#767676", // medium gray
  },
  "input-background": {
    vars: ["--vscode-input-background"],
    default: "#FFFFFF", // white
  },
  "input-foreground": {
    vars: ["--vscode-input-foreground"],
    default: "#3B3B3B", // dark
  },
  "input-border": {
    vars: [
      "--vscode-input-border",
      "--vscode-commandCenter-inactiveBorder",
      "vscode-border",
    ],
    default: "#CECECE", // light border
  },
  "input-placeholder": {
    vars: ["--vscode-input-placeholderForeground"],
    default: "#767676", // muted
  },
  "table-oddRow": {
    vars: ["--vscode-tree-tableOddRowsBackground"],
    default: "#F8F8F8", // very light gray
  },
  "badge-background": {
    vars: ["--vscode-badge-background"],
    default: "#CCCCCC", // light gray
  },
  "badge-foreground": {
    vars: ["--vscode-badge-foreground"],
    default: "#3B3B3B", // dark
  },
  success: {
    vars: [
      "--vscode-notebookStatusSuccessIcon-foreground",
      "--vscode-testing-iconPassed",
      "--vscode-gitDecoration-addedResourceForeground",
      "--vscode-charts-green",
    ],
    default: "#369432", // green
  },
  warning: {
    vars: [
      "--vscode-editorWarning-foreground",
      "--vscode-list-warningForeground",
    ],
    default: "#ffb74d", // amber/yellow (same)
  },
  error: {
    vars: ["--vscode-editorError-foreground", "--vscode-list-errorForeground"],
    default: "#C72E0F", // red
  },
  link: {
    vars: ["--vscode-textLink-foreground"],
    default: "#005FB8", // blue
  },
  accent: {
    vars: ["--vscode-tab-activeBorderTop", "--vscode-focusBorder"],
    default: "#005FB8", // blue
  },
  "find-match": {
    vars: ["--vscode-editor-findMatchBackground"],
    default: "#264f7840", // translucent blue (can keep)
  },
  "find-match-selected": {
    vars: ["--vscode-editor-findMatchHighlightBackground"],
    default: "#ffb74d40", // translucent amber
  },
  "list-hover": {
    vars: ["--vscode-list-hoverBackground"],
    default: "#F2F2F2", // very light gray
  },
  "list-active": {
    vars: ["--vscode-list-activeSelectionBackground"],
    default: "#E8E8E8", // lighter blue/gray
  },
  "list-active-foreground": {
    vars: ["--vscode-list-activeSelectionForeground"],
    default: "#000000", // black
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
