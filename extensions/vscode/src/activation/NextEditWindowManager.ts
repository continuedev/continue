/* eslint-disable @typescript-eslint/naming-convention */
import { EXTENSION_NAME } from "core/control-plane/env";
// @ts-ignore
import * as vscode from "vscode";

import { myersDiff } from "core/diff/myers";
import { getRenderableDiff } from "core/nextEdit/diff/diff";
import { SyntaxHighlighter } from "core/syntaxHighlighting/SyntaxHighlighter";
import { getTheme } from "../util/getTheme";

export interface TextApplier {
  applyText(
    editor: vscode.TextEditor,
    text: string,
    position: vscode.Position,
  ): Promise<boolean>;
}

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
export const ACCEPT_NEXT_EDIT_COMMAND = "nextEditWindow.acceptNextEdit";

export class NextEditWindowManager {
  private static instance: NextEditWindowManager;

  private readonly excludedURIPrefixes = ["output:", "vscode://inline-chat"];
  private readonly hideCommand = "continue.hideNextEditWindow";
  private theme = getTheme() || FALLBACK_THEME;
  private syntaxHighlighter: SyntaxHighlighter;

  // Current active decoration
  private currentDecoration: vscode.TextEditorDecorationType | null = null;
  // Track which editor has the active decoration
  private activeEditor: vscode.TextEditor | null = null;
  // Store the current tooltip text for accepting
  private currentTooltipText: string | null = null;

  // Disposables
  private disposables: vscode.Disposable[] = [];

  private textApplier: TextApplier | null = null;

  private finalCursorPos: vscode.Position | null = null;

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
    this.syntaxHighlighter = SyntaxHighlighter.getInstance({
      theme: "one-dark-pro",
    });
  }

  public setupNextEditWindowManager(
    context: vscode.ExtensionContext,
    textApplier?: TextApplier,
  ) {
    // Register the command to hide tooltips
    const hideTooltipsCommand = vscode.commands.registerCommand(
      HIDE_TOOLTIP_COMMAND,
      () => {
        this.hideAllTooltips();
      },
    );
    context.subscriptions.push(hideTooltipsCommand);

    // Register the command to accept next edit
    const acceptNextEditCommand = vscode.commands.registerCommand(
      ACCEPT_NEXT_EDIT_COMMAND,
      () => {
        this.acceptNextEdit();
      },
    );
    context.subscriptions.push(acceptNextEditCommand);

    // Add this class to context disposables
    context.subscriptions.push(this);

    if (textApplier) {
      this.textApplier = textApplier;
    }
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

    // Store the current tooltip text for accepting later
    this.currentTooltipText = text;

    // Get cursor position
    const position = editor.selection.active;
    const startPos = Math.max(position.line - 5, 0);
    const endPos = Math.min(position.line + 5, editor.document.lineCount - 1);
    const originalSlice = editor.document
      .getText()
      .split("\n")
      .slice(startPos, endPos + 1)
      .join("\n");

    // TODO: we may use a unified diff here if the file is too huge
    // TODO: compare text with the editable region slice.
    const diffLines = myersDiff(originalSlice, text);
    const diff = getRenderableDiff(diffLines);

    this.finalCursorPos = new vscode.Position(
      startPos + diff.offset.line,
      diff.offset.character,
    );

    // Create and apply decoration with the text
    await this.renderTooltip(editor, position, diff.renderableDiff);
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

      this.disposables.forEach((d) => d.dispose());
      this.disposables = [];

      // Clear the current tooltip text
      this.currentTooltipText = null;
    }
    // this.dispose();
  }

  /**
   * Accept the current next edit suggestion by inserting it at cursor position
   */
  private async acceptNextEdit() {
    if (!this.activeEditor || !this.currentTooltipText) {
      return;
    }

    const editor = this.activeEditor;
    const text = this.currentTooltipText;
    const position = editor.selection.active;

    let success = false;
    const USE_TEXT_APPLIER = false;
    // For now we skip using textApplier, because we don't need an apply logic yet.
    // In the future we may use this.
    if (this.textApplier && USE_TEXT_APPLIER) {
      success = await this.textApplier.applyText(editor, text, position);
    } else {
      // applyText already has this,
      // but we could technically have an instance of
      // NextEditWindowManager without the textApplier

      const editableRegionStartLine = Math.max(0, position.line - 5);
      const editableRegionEndLine = Math.min(
        editor.document.lineCount - 1,
        position.line + 5,
      );
      const startPos = new vscode.Position(editableRegionStartLine, 0);
      const endPosChar = editor.document.lineAt(editableRegionEndLine).text
        .length;

      const endPos = new vscode.Position(editableRegionEndLine, endPosChar);
      const editRange = new vscode.Range(startPos, endPos);

      success = await editor.edit((editBuilder) => {
        editBuilder.replace(editRange, text);
      });
    }

    if (success) {
      // Move cursor to the final position if available.
      if (this.finalCursorPos) {
        editor.selection = new vscode.Selection(
          this.finalCursorPos,
          this.finalCursorPos,
        );
      }
      this.hideAllTooltips();
    }
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
      const dimensions = {
        width: tipWidth,
        height: tipHeight,
      };

      // const lines = text.split("\n");
      // const globalIndent =
      //   lines.length > 0 ? (lines[0].match(/^[ \t]*/) || [""])[0].length : 0;

      // const syntaxHighlighter = SyntaxHighlighter.getInstance({
      //   theme: "one-dark-pro",
      // });

      // await syntaxHighlighter.init();

      const uri = await this.syntaxHighlighter.getDataUri(
        text,
        "typescript",
        SVG_CONFIG.fontSize,
        dimensions,
        SVG_CONFIG.lineHeight,
        {
          imageType: "svg",
        },
      );

      // console.log(dimensions);

      return {
        uri: vscode.Uri.parse(uri),
        dimensions,
      };
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
    console.log(text);
    const uriAndDimensions = await this.createSvgTooltip(text);
    if (!uriAndDimensions) {
      return undefined;
    }

    const { uri, dimensions } = uriAndDimensions;

    const blankUri = await this.syntaxHighlighter.getBlankDataUri(dimensions, {
      imageType: "svg",
    });

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
               box-shadow: inset 0 0 0 ${SVG_CONFIG.strokeWidth}px ${SVG_CONFIG.stroke}, inset 0 0 0 ${tipHeight}px ${backgroundColour};
               filter: ${SVG_CONFIG.filter};
               border-radius: ${SVG_CONFIG.radius}px;
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
      `[Dismiss](command:${HIDE_TOOLTIP_COMMAND}) | [Accept (Ctrl+Space, Tab)](command:${ACCEPT_NEXT_EDIT_COMMAND})`,
    );

    hoverMarkdown.isTrusted = true;
    hoverMarkdown.supportHtml = true;
    return hoverMarkdown;
  }

  private isValidRange(
    editor: vscode.TextEditor,
    range: vscode.Range,
  ): boolean {
    const doc = editor.document;

    // Check if line numbers are valid
    if (range.start.line < 0 || range.start.line >= doc.lineCount) {
      console.log(
        "Invalid start line:",
        range.start.line,
        "doc lines:",
        doc.lineCount,
      );
      return false;
    }

    if (range.end.line < 0 || range.end.line >= doc.lineCount) {
      console.log(
        "Invalid end line:",
        range.end.line,
        "doc lines:",
        doc.lineCount,
      );
      return false;
    }

    // Check if character positions are valid
    const startLine = doc.lineAt(range.start.line);
    const endLine = doc.lineAt(range.end.line);

    if (
      range.start.character < 0 ||
      range.start.character > startLine.text.length
    ) {
      console.log(
        "Invalid start character:",
        range.start.character,
        "line length:",
        startLine.text.length,
      );
      return false;
    }

    if (range.end.character < 0 || range.end.character > endLine.text.length) {
      console.log(
        "Invalid end character:",
        range.end.character,
        "line length:",
        endLine.text.length,
      );
      return false;
    }

    return true;
  }

  /**
   * Calculate a position to the right of the cursor with the specified offset
   */
  private getOffsetPosition(
    editor: vscode.TextEditor,
    position: vscode.Position,
  ): vscode.Position {
    // Create a position that's offset spaces to the right of the cursor
    // const offsetChar = position.character + SVG_CONFIG.cursorOffset;
    // return new vscode.Position(position.line, offsetChar);

    const line = editor.document.lineAt(position.line);
    const offsetChar = Math.min(
      position.character + SVG_CONFIG.cursorOffset,
      line.text.length,
    );
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
    // Capture document version to detect changes
    const docVersion = editor.document.version;

    // Create a new decoration with the text
    const decoration = await this.createSvgDecoration(text);
    if (!decoration) {
      console.error("Failed to create decoration for text:", text);
      return;
    }

    // Check if document changed during async operation
    if (editor.document.version !== docVersion) {
      console.log("Document changed during decoration creation, aborting");
      // decoration.dispose();
      // return;
    }

    // Store the decoration and editor
    this.hideAllTooltips();
    this.currentDecoration = decoration;
    this.activeEditor = editor;

    // console.log(decoration);

    // Get the position with offset
    const offsetPosition = this.getOffsetPosition(editor, position);
    const range = new vscode.Range(offsetPosition, offsetPosition);

    // Validate the range before applying
    if (!this.isValidRange(editor, range)) {
      console.error("Invalid range detected, skipping decoration");
      return;
    }

    // Apply the decoration at the offset position
    editor.setDecorations(this.currentDecoration, [
      {
        range: new vscode.Range(offsetPosition, offsetPosition),
        hoverMessage: [this.buildHideTooltipHoverMsg()],
      },
    ]);
  }
}

export default function setupNextEditWindowManager(
  context: vscode.ExtensionContext,
  textApplier?: TextApplier,
) {
  NextEditWindowManager.getInstance().setupNextEditWindowManager(
    context,
    textApplier,
  );
}
