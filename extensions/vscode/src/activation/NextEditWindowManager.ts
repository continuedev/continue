/* eslint-disable @typescript-eslint/naming-convention */
import { EXTENSION_NAME } from "core/control-plane/env";
// @ts-ignore
import * as vscode from "vscode";

import { SyntaxHighlighter } from "core/syntaxHighlighting/SyntaxHighlighter";
import { getTheme } from "../util/getTheme";

// Fallback theme colors
const FALLBACK_THEME = {
  colors: {
    "editor.foreground": "#FFFFFF",
    "editor.background": "#333333",
    // "editor.foreground": "var(--vscode-editor-foreground)",
    // "editor.background": "var(--vscode-editor-background)",
  },
};

const SVG_CONFIG = {
  stroke: "#999998",
  strokeWidth: 1,
  textColor: "#999998",
  filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.2))",
  radius: 3,
  leftMargin: 40,
  defaultText: "",
  lineSpacing: 1.2, // Line spacing multiplier
  cursorOffset: 4, // Spaces to offset from cursor

  get fontSize() {
    return Math.ceil(
      vscode.workspace.getConfiguration("editor").get<number>("fontSize") ?? 14,
    );
  },
  get fontFamily() {
    return (
      vscode.workspace.getConfiguration("editor").get<string>("fontFamily") ||
      "helvetica"
    );
  },
  get paddingX() {
    return Math.ceil(this.getEstimatedTextWidth(" "));
  },
  get paddingY() {
    return Math.ceil(this.fontSize * 0.3);
  },
  get lineHeight() {
    return Math.ceil(this.fontSize * this.lineSpacing);
  },
  getEstimatedTextWidth(text: string): number {
    return text.length * this.fontSize * 0.6;
  },
  getTipWidth(text: string): number {
    // Find the longest line
    const lines = text.split("\n");
    const longestLine = lines.reduce(
      (longest, line) => (line.length > longest.length ? line : longest),
      "",
    );

    return this.getEstimatedTextWidth(longestLine) + this.paddingX * 2;
  },
  getTipHeight(text: string): number {
    // Count the number of lines
    const lineCount = text.split("\n").length;
    return this.lineHeight * lineCount + this.paddingY * 2;
  },
} as const;

// Command ID - can be used in package.json
export const HIDE_TOOLTIP_COMMAND = "nextEditWindow.hideTooltips";

export class NextEditWindowManager {
  private static instance: NextEditWindowManager;

  private readonly excludedURIPrefixes = ["output:", "vscode://inline-chat"];
  private readonly hideCommand = "continue.hideNextEditWindow";
  private theme = getTheme() || FALLBACK_THEME;

  // Current active decoration
  private currentDecoration: vscode.TextEditorDecorationType | null = null;
  // Track which editor has the active decoration
  private activeEditor: vscode.TextEditor | null = null;

  // Disposables
  private disposables: vscode.Disposable[] = [];

  public static getInstance(): NextEditWindowManager {
    if (!NextEditWindowManager.instance) {
      NextEditWindowManager.instance = new NextEditWindowManager();
    }
    return NextEditWindowManager.instance;
  }

  private constructor() {
    console.log(
      "Next Edit Theme initialized:",
      this.theme
        ? `Theme exists: ${JSON.stringify(this.theme)}`
        : "Theme is undefined",
    );
    this.setupListeners();
  }

  public setupNextEditWindowManager(context: vscode.ExtensionContext) {
    // Register the command to hide tooltips
    const hideTooltipsCommand = vscode.commands.registerCommand(
      HIDE_TOOLTIP_COMMAND,
      () => {
        this.hideAllTooltips();
      },
    );
    context.subscriptions.push(hideTooltipsCommand);

    // Add this class to context disposables
    context.subscriptions.push(this);
  }

  /**
   * Show a tooltip with the given text at the current cursor position
   * @param editor The active text editor
   * @param text Text to display in the tooltip
   */
  public async showTooltip(editor: vscode.TextEditor, text: string) {
    if (!text || !this.shouldRenderTip(editor.document.uri)) {
      return;
    }

    // Clear any existing decorations first (very important to prevent overlapping)
    this.hideAllTooltips();
    // this.dispose();

    // Get cursor position
    const position = editor.selection.active;

    // Create and apply decoration with the text
    await this.renderTooltip(editor, position, text);
  }

  /**
   * Hide all tooltips in all editors
   */
  public hideAllTooltips() {
    console.log("hideAllTooltips");
    if (this.currentDecoration) {
      // Remove decoration from all editors to be extra safe
      vscode.window.visibleTextEditors.forEach((editor) => {
        editor.setDecorations(this.currentDecoration!, []);
      });

      // If we know which editor had the decoration, clear it specifically
      if (this.activeEditor) {
        this.activeEditor.setDecorations(this.currentDecoration, []);
        this.activeEditor = null;
      }

      // Dispose the decoration
      this.currentDecoration.dispose();
      this.currentDecoration = null;
    }
    this.dispose();
  }

  public dispose() {
    // Dispose current decoration
    if (this.currentDecoration) {
      this.currentDecoration.dispose();
      this.currentDecoration = null;
    }

    // Dispose all other disposables
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  private setupListeners() {
    // Theme change listener
    const themeListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("workbench.colorTheme") ||
        e.affectsConfiguration("editor.fontSize") ||
        e.affectsConfiguration("editor.fontFamily")
      ) {
        const newTheme = getTheme();
        this.theme = newTheme || FALLBACK_THEME;
        console.log(
          "Theme updated:",
          this.theme ? "Theme exists" : "Theme is undefined",
        );
      }
    });
    this.disposables.push(themeListener);

    // Listen for editor changes to clean up decorations when editor closes
    const editorCloseListener = vscode.window.onDidChangeVisibleTextEditors(
      () => {
        // If our active editor is no longer visible, clear decorations
        if (
          this.activeEditor &&
          !vscode.window.visibleTextEditors.includes(this.activeEditor)
        ) {
          this.hideAllTooltips();
        }
      },
    );
    this.disposables.push(editorCloseListener);

    // Listen for selection changes to hide tooltip when cursor moves
    const selectionListener = vscode.window.onDidChangeTextEditorSelection(
      (e) => {
        // If the selection changed in our active editor, hide the tooltip
        if (this.activeEditor && e.textEditor === this.activeEditor) {
          this.hideAllTooltips();
        }
      },
    );
    this.disposables.push(selectionListener);
  }

  private shouldRenderTip(uri: vscode.Uri): boolean {
    const isAllowedUri =
      !this.excludedURIPrefixes.some((prefix) =>
        uri.toString().startsWith(prefix),
      ) && uri.scheme !== "comment";

    const isEnabled =
      !!vscode.workspace
        .getConfiguration(EXTENSION_NAME)
        .get<boolean>("showInlineTip") === true;

    return isAllowedUri && isEnabled;
  }

  /**
   * Create an SVG with the given text, supporting multiple lines
   */
  private async createSvgTooltip(
    text: string,
  ): Promise<
    | { uri: vscode.Uri; dimensions: { width: number; height: number } }
    | undefined
  > {
    console.log("createSvgTooltip");
    const baseTextConfig = {
      "font-family": SVG_CONFIG.fontFamily,
      "font-size": SVG_CONFIG.fontSize,
      fill: this.theme.colors["editor.foreground"],
    };

    try {
      const tipWidth = SVG_CONFIG.getTipWidth(text);
      const tipHeight = SVG_CONFIG.getTipHeight(text);

      const lines = text.split("\n");
      const globalIndent =
        lines.length > 0 ? (lines[0].match(/^[ \t]*/) || [""])[0].length : 0;

      const syntaxHighlighter = SyntaxHighlighter.getInstance({
        theme: "one-dark-pro",
      });

      await syntaxHighlighter.init();

      const { uri, dimensions } =
        await syntaxHighlighter.getDataUriAndDimensions(
          text,
          "typescript",
          SVG_CONFIG.fontSize,
          {
            imageType: "svg",
          },
        );

      console.log(dimensions);

      return { uri: vscode.Uri.parse(uri), dimensions: dimensions };
    } catch (error) {
      console.error("Error creating SVG tooltip:", error);
      return undefined;
    }
  }

  /**
   * Create a decoration type with SVG content
   */
  private async createSvgDecoration(
    text: string,
  ): Promise<vscode.TextEditorDecorationType | undefined> {
    console.log("createSvgDecoration");
    const uriAndDimensions = await this.createSvgTooltip(text);
    if (!uriAndDimensions) {
      return undefined;
    }

    const { uri, dimensions } = uriAndDimensions;

    // Use theme or fallback
    const backgroundColour = this.theme.colors["editor.background"];
    // const tipWidth = SVG_CONFIG.getTipWidth(text);
    // const tipHeight = SVG_CONFIG.getTipHeight(text);
    const tipWidth = dimensions.width;
    const tipHeight = dimensions.height;

    return vscode.window.createTextEditorDecorationType({
      after: {
        contentIconPath: uri,
        // border: `;box-shadow: inset 0 0 0 ${SVG_CONFIG.strokeWidth}px ${SVG_CONFIG.stroke}, inset 0 0 0 ${tipHeight}px ${backgroundColour};
        //           border-radius: ${SVG_CONFIG.radius}px;
        //           filter: ${SVG_CONFIG.filter}`,
        // width: `${tipWidth}px`,
        // height: `${tipHeight}px`,
        // border: `transparent; position: absolute; z-index: 1000;
        //        box-shadow: inset 0 0 0 ${SVG_CONFIG.strokeWidth}px ${SVG_CONFIG.stroke},
        //                   inset 0 0 0 ${tipHeight}px ${backgroundColour};
        //        border-radius: ${SVG_CONFIG.radius}px;
        //        filter: ${SVG_CONFIG.filter};
        //        margin-left: ${SVG_CONFIG.cursorOffset * 8}px;`,
        border: `transparent; position: absolute; z-index: 1000;
               margin-left: ${SVG_CONFIG.cursorOffset * 8}px;`,
        // border: `solid 1px white; position: absolute; z-index: 1000;
        //        margin-left: ${SVG_CONFIG.cursorOffset * 8}px;
        //        margin-top: 0em;`,
        // border: `solid 1px white; position: absolute; z-index: 1000;
        //        margin: 0em; padding: 0em;
        //        margin-left: ${SVG_CONFIG.cursorOffset * 8}px;
        //        margin-top: 0em;`,
        width: `${tipWidth}px`,
        height: `${tipHeight}px`,
        // textDecoration: `none; transform: translateY(-100%);`,
      },
      // Set a negative margin to make the decoration float if it starts to displace text.
      // Also use absolute positioning.
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
  }

  private buildHideTooltipHoverMsg() {
    const hoverMarkdown = new vscode.MarkdownString(
      `[Dismiss](command:${HIDE_TOOLTIP_COMMAND})`,
    );

    hoverMarkdown.isTrusted = true;
    hoverMarkdown.supportHtml = true;
    return hoverMarkdown;
  }

  /**
   * Calculate a position to the right of the cursor with the specified offset
   */
  private getOffsetPosition(
    editor: vscode.TextEditor,
    position: vscode.Position,
  ): vscode.Position {
    // Create a position that's offset spaces to the right of the cursor
    const offsetChar = position.character + SVG_CONFIG.cursorOffset;
    return new vscode.Position(position.line, offsetChar);
  }

  /**
   * Render a tooltip with the given text at the specified position
   */
  private async renderTooltip(
    editor: vscode.TextEditor,
    position: vscode.Position,
    text: string,
  ) {
    console.log("renderTooltip");
    // Create a new decoration with the text
    const decoration = await this.createSvgDecoration(text);
    if (!decoration) {
      console.error("Failed to create decoration for text:", text);
      return;
    }

    // Store the decoration and editor
    this.currentDecoration = decoration;
    this.activeEditor = editor;

    // Get the position with offset
    const offsetPosition = this.getOffsetPosition(editor, position);

    // Apply the decoration at the offset position
    editor.setDecorations(decoration, []);
    editor.setDecorations(decoration, [
      {
        range: new vscode.Range(offsetPosition, offsetPosition),
        hoverMessage: [this.buildHideTooltipHoverMsg()],
      },
    ]);
  }
}

export default function setupNextEditWindowManager(
  context: vscode.ExtensionContext,
) {
  NextEditWindowManager.getInstance().setupNextEditWindowManager(context);
}
