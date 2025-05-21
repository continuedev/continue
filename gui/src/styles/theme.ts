// All vscode variables https://gist.github.com/estruyf/ba49203e1a7d6868e9320a4ea480c27a
// Examples for vscode https://github.com/githubocto/tailwind-vscode/blob/main/index.js
export const THEME_COLORS = {
  background: {
    var: "--vscode-sideBar-background",
    default: "#141c2d",
  },
  foreground: {
    var: "--vscode-sideBar-foreground", // --vscode-editor-foreground
    default: "rgba(243, 239, 245, 0.8)",
  },
  editor: {
    var: "--vscode-editor-background",
    default: "#0e131f",
  },
  "editor-foreground": {
    var: "--vscode-editor-foreground",
    default: "#f3eff5",
  },
  "primary-background": {
    var: "--vscode-button-background",
    default: "#1bbe84",
  },
  "primary-foreground": {
    var: "--vscode-button-foreground",
    default: "#ffffff",
  },
  "primary-hover": {
    var: "--vscode-button-hoverBackground",
    default: "#24dfe8",
  },
  secondary: {
    var: "--vscode-button-secondaryBackground",
    default: "rgba(243, 239, 245, 0.2)",
  },
  "secondary-foreground": {
    var: "--vscode-button-secondaryForeground",
    default: "#f3eff5",
  },
  "secondary-hover": {
    var: "--vscode-button-secondaryHoverBackground",
    default: "rgba(243, 239, 245, 0.2)",
  },
  border: {
    // --vscode-panel-border
    var: "--vscode-sideBar-border",
    default: "#242d34",
  },
  "border-focus": {
    var: "--vscode-focusBorder",
    default: "#263354",
  },
  // Command styles are used for tip-tap editor
  command: {
    var: "--vscode-commandCenter-background",
    default: "#141c2d",
  },
  "command-foreground": {
    var: "--vscode-commandCenter-foreground",
    default: "#f3eff5",
  },
  "command-border": {
    var: "--vscode-commandCenter-inactiveBorder",
    default: "#999998",
  },
  "command-border-focus": {
    var: "--vscode-commandCenter-activeBorder",
    default: "#ed1292",
  },
  description: {
    var: "--vscode-descriptionForeground",
    default: "rgba(243, 239, 245, 0.7)",
  },
  "description-muted": {
    var: "--vscode-list-deemphasizedForeground",
    default: "#8c8c8c",
  },
  "input-background": {
    var: "--vscode-input-background",
    default: "#0d1217",
  },
  "input-foreground": {
    var: "--vscode-input-foreground",
    default: "#f3eff5",
  },
  "input-border": {
    var: "--vscode-input-border",
    default: "#242d34",
  },
  "input-placeholder": {
    var: "--vscode-input-placeholderForeground",
    default: "rgba(243, 239, 245, 0.5)",
  },
  "table-oddRow": {
    var: "--vscode-tree-tableOddRowsBackground",
    default: "rgb(45, 45, 45)",
  },
  badge: {
    var: "--vscode-badge-background",
    default: "rgb(80, 80, 80)",
  },
  "badge-foreground": {
    var: "--vscode-badge-foreground",
    default: "#fff",
  },
  success: {
    var: "--vscode-notebookStatusSuccessIcon-foreground", // "var(--vscode-testing-iconPassed, #1bbe84)" // --vscode-charts-green
    default: "#1bbe84",
  },
  warning: {
    var: "--vscode-editorWarning-foreground", // --vscode-list-warningForeground
    default: "#ffe45e",
  },
  error: {
    var: "--vscode-editorError-foreground", // --vscode-list-errorForeground
    default: "#fe4a49",
  },
  link: {
    var: "--vscode-textLink-foreground",
    default: "#4da6ff",
  },
  accent: {
    var: "--vscode-tab-activeBorderTop",
    default: "#ed1292",
  },
  "find-match": {
    var: "--vscode-editor-findMatchBackground", // Can't get "var(--vscode-editor-findMatchBackground, rgba(237, 18, 146, 0.5))" to work
    default: "rgba(191, 219, 254, 0.3)",
  },
  "find-match-selected": {
    var: "--vscode-editor-findMatchHighlightBackground",
    default: "rgba(255, 223, 0, 0.3)",
  },
  "list-hover": {
    var: "--vscode-list-hoverBackground",
    default: "rgba(243, 239, 245, 0.13)",
  },
  "list-active": {
    var: "--vscode-list-activeSelectionBackground",
    default: "rgba(243, 239, 245, 0.2)",
  },
  "list-active-foreground": {
    var: "--vscode-list-activeSelectionForeground",
    default: "#f3eff5",
  },
};

// Consider defaults
// export const vscInputBackground = `var(${VSC_INPUT_BACKGROUND_VAR}, rgb(45 45 45))`;
// export const vscQuickInputBackground = `var(${VSC_QUICK_INPUT_BACKGROUND_VAR}, ${VSC_INPUT_BACKGROUND_VAR}, rgb(45 45 45))`;
// export const vscBackground = `var(${VSC_BACKGROUND_VAR}, rgb(30 30 30))`;
// export const vscForeground = `var(${VSC_FOREGROUND_VAR}, #fff)`;
// export const vscButtonBackground = `var(${VSC_BUTTON_BACKGROUND_VAR}, #1bbe84)`;
// export const vscButtonForeground = `var(${VSC_BUTTON_FOREGROUND_VAR}, #ffffff)`;
// export const vscEditorBackground = `var(${VSC_EDITOR_BACKGROUND_VAR}, ${VSC_BACKGROUND_VAR}, rgb(30 30 30))`;
// export const vscListActiveBackground = `var(${VSC_LIST_SELECTION_BACKGROUND_VAR}, #1bbe84)`;
// export const vscFocusBorder = `var(${VSC_FOCUS_BORDER_VAR}, #1bbe84)`;
// export const vscListActiveForeground = `var(${VSC_LIST_ACTIVE_FOREGROUND_VAR}, ${VSC_FOREGROUND_VAR})`;
// export const vscInputBorder = `var(${VSC_INPUT_BORDER_VAR}, ${lightGray})`;
// export const vscInputBorderFocus = `var(${VSC_FOCUS_BORDER_VAR}, ${lightGray})`;
// export const vscBadgeBackground = `var(${VSC_BADGE_BACKGROUND_VAR}, #1bbe84)`;
// export const vscBadgeForeground = `var(${VSC_BADGE_FOREGROUND_VAR}, #ffffff)`;
// export const vscCommandCenterActiveBorder = `var(${VSC_COMMAND_CENTER_ACTIVE_BORDER_VAR}, #1bbe84)`;
// export const vscCommandCenterInactiveBorder = `var(${VSC_COMMAND_CENTER_INACTIVE_BORDER_VAR}, #1bbe84)`;
// export const vscFindMatchSelected = `var(${VSC_FIND_MATCH_SELECTED_VAR}, rgba(255, 223, 0))`;

// Fonts:
// --vscode - editor - font - family;
// --vscode - font - family;

// Current list of CSS variables needed (e.g. for jetbrains to send!)
// --vscode-sideBar-background
// --vscode-sideBar-foreground
// --vscode-editor-background
// --vscode-editor-foreground
// --vscode-button-background
// --vscode-button-foreground
// --vscode-button-secondaryBackground
// --vscode-button-secondaryForeground
// --vscode-sideBar-border
// --vscode-focusBorder
// --vscode-commandCenter-background
// --vscode-commandCenter-foreground
// --vscode-commandCenter-inactiveBorder
// --vscode-commandCenter-activeBorder
// --vscode-descriptionForeground
// --vscode-list-deemphasizedForeground
// --vscode-input-background
// --vscode-input-foreground
// --vscode-input-border
// --vscode-input-placeholderForeground
// --vscode-tree-tableOddRowsBackground
// --vscode-badge-background
// --vscode-badge-foreground
// --vscode-notebookStatusSuccessIcon-foreground
// --vscode-editorWarning-foreground
// --vscode-editorError-foreground
// --vscode-editor-findMatchBackground
// --vscode-editor-findMatchHighlightBackground
// --vscode-list-hoverBackground
// --vscode-list-activeSelectionBackground
// --vscode-list-activeSelectionForeground

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
