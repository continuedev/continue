/* eslint-disable @typescript-eslint/naming-convention */
import { EXTENSION_NAME } from "core/control-plane/env";
// @ts-ignore
import * as vscode from "vscode";

import { myersDiff } from "core/diff/myers";
import { getRenderableDiff } from "core/nextEdit/diff/diff";
import { SyntaxHighlighter } from "core/syntaxHighlighting/SyntaxHighlighter";
import { getThemeString } from "../util/getTheme";

export interface TextApplier {
  applyText(
    editor: vscode.TextEditor,
    text: string,
    position: vscode.Position,
    finalCursorPos: vscode.Position | null,
  ): Promise<boolean>;
}

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
  private static instance: NextEditWindowManager | undefined;

  private readonly excludedURIPrefixes = ["output:", "vscode://inline-chat"];
  private readonly hideCommand = "continue.hideNextEditWindow";
  private theme: string;
  private fontSize: number;
  private fontFamily: string;
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

  public static isInstantiated(): boolean {
    return !!NextEditWindowManager.instance;
  }

  public static clearInstance(): void {
    if (NextEditWindowManager.instance) {
      NextEditWindowManager.instance.dispose();
      NextEditWindowManager.instance = undefined;
    }
  }

  private constructor() {
    this.theme = getThemeString();

    console.log(
      "Next Edit Theme initialized:",
      this.theme
        ? `Theme exists: ${JSON.stringify(this.theme)}`
        : "Theme is undefined",
    );
    this.setupListeners();
    this.syntaxHighlighter = SyntaxHighlighter.getInstance();
    this.syntaxHighlighter.setTheme(this.theme);

    const editorConfig = vscode.workspace.getConfiguration("editor");
    this.fontSize = editorConfig.get<number>("fontSize") ?? 14;
    this.fontFamily = editorConfig.get<string>("fontFamily") ?? "monospace";
  }

  public async setupNextEditWindowManager(
    context: vscode.ExtensionContext,
    textApplier?: TextApplier,
  ) {
    await vscode.commands.executeCommand(
      "setContext",
      "nextEditWindowActive",
      false,
    );

    // Helper function to register commands safely.
    const registerCommandSafely = (
      commandId: string,
      callback: () => Promise<void>,
    ) => {
      try {
        const command = vscode.commands.registerCommand(commandId, callback);
        context.subscriptions.push(command);
      } catch (error) {
        console.log(
          `Command ${commandId} already has an associated callback, skipping registration`,
        );
      }
    };

    // Register HIDE_TOOLTIP_COMMAND and ACCEPT_NEXT_EDIT_COMMAND
    // with their corresponding callbacks.
    registerCommandSafely(
      HIDE_TOOLTIP_COMMAND,
      async () => await this.hideAllTooltips(),
    );
    registerCommandSafely(
      ACCEPT_NEXT_EDIT_COMMAND,
      async () => await this.acceptNextEdit(),
    );

    // Add this class to context disposables.
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
  public async showTooltip(
    editor: vscode.TextEditor,
    newEditRangeSlice: string,
  ) {
    if (!newEditRangeSlice || !this.shouldRenderTip(editor.document.uri)) {
      return;
    }

    // Clear any existing decorations first (very important to prevent overlapping).
    await this.hideAllTooltips();

    // Store the current tooltip text for accepting later.
    this.currentTooltipText = newEditRangeSlice;

    // Get current cursor position.
    const position = editor.selection.active;
    const startPos = Math.max(position.line - 5, 0);
    const endPos = Math.min(position.line + 5, editor.document.lineCount - 1);
    const oldEditRangeSlice = editor.document
      .getText()
      .split("\n")
      .slice(startPos, endPos + 1)
      .join("\n");

    if (oldEditRangeSlice === newEditRangeSlice) return;

    const diffLines = myersDiff(oldEditRangeSlice, newEditRangeSlice);
    const lineOffsetAtCursorPos = position.line - startPos;
    const lineContentAtCursorPos =
      newEditRangeSlice.split("\n")[lineOffsetAtCursorPos];

    const diff = getRenderableDiff(
      diffLines,
      lineContentAtCursorPos,
      lineOffsetAtCursorPos,
    );

    // Calculate the actual line number in the editor by adding the startPos offset
    // to the line number from the diff calculation
    this.finalCursorPos = new vscode.Position(
      startPos + diff.offset.line,
      diff.offset.character,
    );

    // Stops the manager from rendering blank windows when there is nothing to render.
    if (newEditRangeSlice === "") {
      return;
    }

    // Create and apply decoration with the text
    await this.renderTooltip(editor, position, newEditRangeSlice);
    await vscode.commands.executeCommand(
      "setContext",
      "nextEditWindowActive",
      true,
    );

    console.log(
      await vscode.commands.executeCommand(
        "getContext",
        "nextEditWindowActive",
      ),
    );
  }

  /**
   * Hide all tooltips in all editors
   */
  public async hideAllTooltips() {
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

    await vscode.commands.executeCommand(
      "setContext",
      "nextEditWindowActive",
      false,
    );

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
    if (this.textApplier) {
      success = await this.textApplier.applyText(
        editor,
        text,
        position,
        this.finalCursorPos,
      );
    } else {
      // Define the editable region.
      const editableRegionStartLine = Math.max(0, position.line - 5);
      const editableRegionEndLine = Math.min(
        editor.document.lineCount - 1,
        position.line + 5,
      );
      const startPos = new vscode.Position(editableRegionStartLine, 0);
      const endPosChar = editor.document.lineAt(editableRegionEndLine).text
        .length;

      // const endPos = new vscode.Position(editableRegionEndLine + 1, 0);
      const endPos = new vscode.Position(editableRegionEndLine, endPosChar);
      const editRange = new vscode.Range(startPos, endPos);

      success = await editor.edit((editBuilder) => {
        editBuilder.replace(editRange, text);
      });
      // Disable inline suggestions temporarily.
      // This prevents the race condition between vscode's inline completion provider
      // and the next edit window manager's cursor repositioning logic.
      // await vscode.commands.executeCommand("editor.action.inlineSuggest.hide");
      await vscode.workspace
        .getConfiguration()
        .update("editor.inlineSuggest.enabled", false, true);
    }

    if (success) {
      // Move cursor to the final position if available.
      if (this.finalCursorPos) {
        editor.selection = new vscode.Selection(
          this.finalCursorPos,
          this.finalCursorPos,
        );

        // Reenable inline suggestions after we move the cursor.
        await vscode.workspace
          .getConfiguration()
          .update("editor.inlineSuggest.enabled", true, true);

        // This prevents the race condition between vscode's inline completion provider
        // and the next edit window manager's cursor repositioning logic.
        // await vscode.commands.executeCommand(
        //   "editor.action.inlineSuggest.hide",
        // );

        await this.hideAllTooltips();
      }
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
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("workbench.colorTheme") ||
        e.affectsConfiguration("editor.fontSize") ||
        e.affectsConfiguration("editor.fontFamily") ||
        e.affectsConfiguration("window.autoDetectColorScheme") ||
        e.affectsConfiguration("window.autoDetectHighContrast") ||
        e.affectsConfiguration("workbench.preferredDarkColorTheme") ||
        e.affectsConfiguration("workbench.preferredLightColorTheme") ||
        e.affectsConfiguration("workbench.preferredHighContrastColorTheme") ||
        e.affectsConfiguration("workbench.preferredHighContrastLightColorTheme")
      ) {
        this.theme = getThemeString();
        this.syntaxHighlighter.setTheme(this.theme);
        console.log(
          "Theme updated:",
          this.theme ? "Theme exists" : "Theme is undefined",
        );
        const editorConfig = vscode.workspace.getConfiguration("editor");
        this.fontSize = editorConfig.get<number>("fontSize") ?? 14;
        this.fontFamily = editorConfig.get<string>("fontFamily") ?? "monospace";
      }
    });
    // this.disposables.push(themeListener);

    // Listen for active color theme changes
    vscode.window.onDidChangeActiveColorTheme(() => {
      this.theme = getThemeString();
      this.syntaxHighlighter.setTheme(this.theme);
      console.log(
        "Active theme changed:",
        this.theme ? "Theme exists" : "Theme is undefined",
      );
    });
    // this.disposables.push(activeThemeListener);

    // Listen for editor changes to clean up decorations when editor closes
    vscode.window.onDidChangeVisibleTextEditors(async () => {
      // If our active editor is no longer visible, clear decorations
      if (
        this.activeEditor &&
        !vscode.window.visibleTextEditors.includes(this.activeEditor)
      ) {
        await this.hideAllTooltips();
      }
    });
    // this.disposables.push(editorCloseListener);

    // Listen for selection changes to hide tooltip when cursor moves
    vscode.window.onDidChangeTextEditorSelection(async (e) => {
      // If the selection changed in our active editor, hide the tooltip
      if (this.activeEditor && e.textEditor === this.activeEditor) {
        await this.hideAllTooltips();
      }
    });
    // this.disposables.push(selectionListener);
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

    try {
      const tipWidth = SVG_CONFIG.getTipWidth(text);
      const tipHeight = SVG_CONFIG.getTipHeight(text);
      const dimensions = {
        width: tipWidth,
        height: tipHeight,
      };

      const uri = await this.syntaxHighlighter.getDataUri(
        text,
        "typescript",
        this.fontSize,
        this.fontFamily,
        dimensions,
        SVG_CONFIG.lineHeight,
        {
          imageType: "svg",
        },
      );

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
    // console.log(text);
    const uriAndDimensions = await this.createSvgTooltip(text);
    if (!uriAndDimensions) {
      return undefined;
    }

    const { uri, dimensions } = uriAndDimensions;
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
               box-shadow: inset 0 0 0 ${SVG_CONFIG.strokeWidth}px ${SVG_CONFIG.stroke}, inset 0 0 0 ${tipHeight}px;
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
    // Create a position that's offset spaces to the right of the cursor.

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
    await this.hideAllTooltips();
    this.currentDecoration = decoration;
    this.activeEditor = editor;

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

export default async function setupNextEditWindowManager(
  context: vscode.ExtensionContext,
  textApplier?: TextApplier,
) {
  await NextEditWindowManager.getInstance().setupNextEditWindowManager(
    context,
    textApplier,
  );
}
