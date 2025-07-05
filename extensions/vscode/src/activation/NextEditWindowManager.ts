/* eslint-disable @typescript-eslint/naming-convention */
import { EXTENSION_NAME } from "core/control-plane/env";
// @ts-ignore
import * as vscode from "vscode";

import { DiffLine } from "core";
import { CodeRenderer } from "core/codeRenderer/CodeRenderer";
import {
  NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
  NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
} from "core/nextEdit/constants";
import { getOffsetPositionAtLastNewLine } from "core/nextEdit/diff/diff";
import { NextEditLoggingService } from "core/nextEdit/NextEditLoggingService";
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
  lineSpacing: 1.3, // Line spacing multiplier
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
export const HIDE_NEXT_EDIT_SUGGESTION_COMMAND =
  "continue.nextEditWindow.hideNextEditSuggestion";
export const ACCEPT_NEXT_EDIT_SUGGESTION_COMMAND =
  "continue.nextEditWindow.acceptNextEditSuggestion";

export class NextEditWindowManager {
  private static instance: NextEditWindowManager | undefined;

  private readonly excludedURIPrefixes = ["output:", "vscode://inline-chat"];
  private theme: string;
  private fontSize: number;
  private fontFamily: string;
  private codeRenderer: CodeRenderer;

  // Current active decoration
  private currentDecoration: vscode.TextEditorDecorationType | null = null;
  // A short-lived checker to determine if the cursor moved because of us accepting the next edit, or not.
  // Distinguishing the two is necessary to determine if we should log it as an accepted or rejected.
  private accepted: boolean = false;
  // Track which editor has the active decoration
  private activeEditor: vscode.TextEditor | null = null;
  // Store the current tooltip text for accepting
  private currentTooltipText: string | null = null;
  // Track for logging purposes.
  private loggingService: NextEditLoggingService;
  private mostRecentCompletionId: string | null = null;

  // Disposables
  private disposables: vscode.Disposable[] = [];

  private textApplier: TextApplier | null = null;

  private finalCursorPos: vscode.Position | null = null;

  private context: vscode.ExtensionContext | null = null;

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
    this.codeRenderer = CodeRenderer.getInstance();

    const editorConfig = vscode.workspace.getConfiguration("editor");
    this.fontSize = editorConfig.get<number>("fontSize") ?? 14;
    this.fontFamily = editorConfig.get<string>("fontFamily") ?? "monospace";

    this.loggingService = NextEditLoggingService.getInstance();
  }

  public static async reserveTabAndEsc() {
    await vscode.commands.executeCommand(
      "setContext",
      "nextEditWindowActive",
      true,
    );
  }

  public static async freeTabAndEsc() {
    await vscode.commands.executeCommand(
      "setContext",
      "nextEditWindowActive",
      false,
    );
  }

  /**
   * An async setup function to help us initialize the NextEditWindowManager.
   * This is necessary because we need some setup to be done asynchronously,
   * and constructors in TypeScript cannot be async.
   * Plus, it's generally not recommended to pass arguments to getInstance() of a singleton.
   * @param context The extension context.
   * @param textApplier Callback that lets us use external deps such as llms if needed.
   */
  public async setupNextEditWindowManager(
    context: vscode.ExtensionContext,
    textApplier?: TextApplier,
  ) {
    this.context = context;

    // Set nextEditWindowActive to false to free esc and tab,
    // letting them return to their original behaviors.
    await NextEditWindowManager.freeTabAndEsc();

    // Register HIDE_TOOLTIP_COMMAND and ACCEPT_NEXT_EDIT_COMMAND with their corresponding callbacks.
    this.registerCommandSafely(
      HIDE_NEXT_EDIT_SUGGESTION_COMMAND,
      async () => await this.hideAllNextEditWindowsAndResetCompletionId(),
    );
    this.registerCommandSafely(
      ACCEPT_NEXT_EDIT_SUGGESTION_COMMAND,
      async () => await this.acceptNextEdit(),
    );

    // Add this class to context disposables.
    context.subscriptions.push(this);

    if (textApplier) {
      this.textApplier = textApplier;
    }

    await this.codeRenderer.setTheme(this.theme);
  }

  /**
   * Update the most recent completion id.
   * @param completionId The id of current completion request.
   */
  public updateCurrentCompletionId(completionId: string) {
    this.mostRecentCompletionId = completionId;
  }

  /**
   * Registers our two custom commands to the extension context.
   * @param commandId Custom commands to help set up next edit.
   * @param callback Function to run on command execution.
   */
  private registerCommandSafely(
    commandId:
      | "continue.nextEditWindow.hideNextEditSuggestion"
      | "continue.nextEditWindow.acceptNextEditSuggestion",
    callback: () => Promise<void>,
  ) {
    if (!this.context) {
      console.log("Extension context is not yet set.");
      return;
    }

    try {
      const command = vscode.commands.registerCommand(commandId, callback);
      this.context.subscriptions.push(command);
    } catch (error) {
      console.log(
        `Command ${commandId} already has an associated callback, skipping registration`,
      );
    }
  }

  /**
   * Show a tooltip with the given text at the current cursor position.
   * @param editor The active text editor.
   * @param text Text to display in the tooltip.
   */
  public async showNextEditWindow(
    editor: vscode.TextEditor,
    currCursorPos: vscode.Position,
    editableRegionStartLine: number,
    oldEditRangeSlice: string,
    newEditRangeSlice: string,
    diffLines: DiffLine[],
  ) {
    if (!newEditRangeSlice || !this.shouldRenderTip(editor.document.uri)) {
      return;
    }

    // Clear any existing decorations first (very important to prevent overlapping).
    await this.hideAllNextEditWindows();

    // Store the current tooltip text for accepting later.
    this.currentTooltipText = newEditRangeSlice;

    // How far away is the current line from the start of the editable region?
    const lineOffsetAtCursorPos = currCursorPos.line - editableRegionStartLine;

    // How long is the line at the current cursor position?
    const lineContentAtCursorPos =
      newEditRangeSlice.split("\n")[lineOffsetAtCursorPos];

    const offset = getOffsetPositionAtLastNewLine(
      diffLines,
      lineContentAtCursorPos,
      lineOffsetAtCursorPos,
    );

    // Calculate the actual line number in the editor by adding the startPos offset
    // to the line number from the diff calculation.
    this.finalCursorPos = new vscode.Position(
      editableRegionStartLine + offset.line,
      offset.character,
    );

    // Create and apply decoration with the text.
    await this.renderTooltip(
      editor,
      currCursorPos,
      oldEditRangeSlice,
      newEditRangeSlice,
      editableRegionStartLine,
    );

    // Reserve tab and esc to either accept or reject the displayed next edit contents.
    await NextEditWindowManager.reserveTabAndEsc();
  }

  /**
   * Hide all tooltips in all editors.
   */
  public async hideAllNextEditWindows() {
    if (this.currentDecoration) {
      vscode.window.visibleTextEditors.forEach((editor) => {
        editor.setDecorations(this.currentDecoration!, []);
      });

      // If we know which editor had the decoration, clear it specifically.
      // This is a bit redundant but ensures we don't leave any decorations behind.
      if (this.activeEditor) {
        this.activeEditor.setDecorations(this.currentDecoration, []);
        this.activeEditor = null;
      }

      // This prevents memory leaks.
      this.currentDecoration.dispose();
      this.currentDecoration = null;

      this.disposables.forEach((d) => d.dispose());
      this.disposables = [];

      // Clear the current tooltip text.
      this.currentTooltipText = null;
    }

    await NextEditWindowManager.freeTabAndEsc();
  }

  public async hideAllNextEditWindowsAndResetCompletionId() {
    this.hideAllNextEditWindows();

    // Log with accept = false.
    await vscode.commands.executeCommand(
      "continue.logNextEditOutcomeReject",
      this.mostRecentCompletionId,
      this.loggingService,
    );
    this.mostRecentCompletionId = null;
  }

  /**
   * Accept the current next edit suggestion by inserting it at cursor position.
   */
  private async acceptNextEdit() {
    if (!this.activeEditor || !this.currentTooltipText) {
      return;
    }
    this.accepted = true;

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
      const editableRegionStartLine = Math.max(
        0,
        position.line - NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
      );
      const editableRegionEndLine = Math.min(
        editor.document.lineCount - 1,
        position.line + NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
      );
      const startPos = new vscode.Position(editableRegionStartLine, 0);
      const endPosChar = editor.document.lineAt(editableRegionEndLine).text
        .length;

      const endPos = new vscode.Position(editableRegionEndLine, endPosChar);
      const editRange = new vscode.Range(startPos, endPos);

      success = await editor.edit((editBuilder) => {
        editBuilder.replace(editRange, text);
      });

      // Disable inline suggestions temporarily.
      // This prevents the race condition between vscode's inline completion provider
      // and the next edit window manager's cursor repositioning logic.
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

        await this.hideAllNextEditWindows();
      }
    }

    // Log with accept = true.
    await vscode.commands.executeCommand(
      "continue.logNextEditOutcomeAccept",
      this.mostRecentCompletionId,
      this.loggingService,
    );
    this.mostRecentCompletionId = null;

    // Reset to false for future logging.
    this.accepted = false;
  }

  /**
   * Dispose of the NextEditWindowManager.
   */
  public dispose() {
    // Dispose current decoration.
    if (this.currentDecoration) {
      this.currentDecoration.dispose();
      this.currentDecoration = null;
    }

    // Dispose all other disposables.
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  /**
   * Setup listeners for theme, font, and cursor position changes.
   */
  private setupListeners() {
    // Theme change listener.
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
        this.codeRenderer.setTheme(this.theme);
        console.log(
          "Theme updated:",
          this.theme ? "Theme exists" : "Theme is undefined",
        );
        const editorConfig = vscode.workspace.getConfiguration("editor");
        this.fontSize = editorConfig.get<number>("fontSize") ?? 14;
        this.fontFamily = editorConfig.get<string>("fontFamily") ?? "monospace";
      }
    });

    // Listen for active color theme changes.
    vscode.window.onDidChangeActiveColorTheme(() => {
      this.theme = getThemeString();
      this.codeRenderer.setTheme(this.theme);
      console.log(
        "Active theme changed:",
        this.theme ? "Theme exists" : "Theme is undefined",
      );
    });

    // Listen for editor changes to clean up decorations when editor closes.
    vscode.window.onDidChangeVisibleTextEditors(async () => {
      // If our active editor is no longer visible, clear decorations.
      if (
        this.activeEditor &&
        !vscode.window.visibleTextEditors.includes(this.activeEditor)
      ) {
        if (this.mostRecentCompletionId)
          this.loggingService.cancelRejectionTimeout(
            this.mostRecentCompletionId,
          );
        await this.hideAllNextEditWindows();
      }
    });

    // Listen for selection changes to hide tooltip when cursor moves.
    vscode.window.onDidChangeTextEditorSelection(async (e) => {
      // If the selection changed in our active editor, hide the tooltip.
      if (this.activeEditor && e.textEditor === this.activeEditor) {
        // If the cursor moved because of something other than accepting next edit, stop logging it.
        if (!this.accepted && this.mostRecentCompletionId)
          this.loggingService.cancelRejectionTimeout(
            this.mostRecentCompletionId,
          );
        await this.hideAllNextEditWindows();
      }
    });
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
   * Create a render of the given code, supporting multiple lines.
   */
  private async createCodeRender(
    text: string,
    currLineOffsetFromTop: number,
  ): Promise<
    | { uri: vscode.Uri; dimensions: { width: number; height: number } }
    | undefined
  > {
    try {
      const tipWidth = SVG_CONFIG.getTipWidth(text);
      const tipHeight = SVG_CONFIG.getTipHeight(text);
      const dimensions = {
        width: tipWidth,
        height: tipHeight,
      };

      const uri = await this.codeRenderer.getDataUri(
        text,
        "typescript",
        this.fontSize,
        this.fontFamily,
        dimensions,
        SVG_CONFIG.lineHeight,
        {
          imageType: "svg",
        },
        currLineOffsetFromTop,
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
   * Create a decoration type with the code render.
   * @param code: The code to render.
   * @returns The decoration.
   */
  private async createCodeRenderDecoration(
    originalCode: string,
    predictedCode: string,
    position: vscode.Position,
    editableRegionStartLine: number,
  ): Promise<vscode.TextEditorDecorationType | undefined> {
    const currLineOffsetFromTop = position.line - editableRegionStartLine;
    const uriAndDimensions = await this.createCodeRender(
      predictedCode,
      currLineOffsetFromTop,
    );
    if (!uriAndDimensions) {
      return undefined;
    }

    const { uri, dimensions } = uriAndDimensions;
    const tipWidth = dimensions.width;
    const tipHeight = dimensions.height;

    const offsetFromTop =
      (position.line - editableRegionStartLine) * SVG_CONFIG.lineHeight;

    // Set the margin-left so that it's never covering code inside the editable region.
    const marginLeft =
      SVG_CONFIG.getTipWidth(originalCode) -
      SVG_CONFIG.getTipWidth(originalCode.split("\n")[currLineOffsetFromTop]);

    console.log(marginLeft);
    console.log(SVG_CONFIG.getTipWidth(originalCode));
    console.log(
      SVG_CONFIG.getTipWidth(originalCode.split("\n")[currLineOffsetFromTop]),
    );
    console.log(originalCode.split("\n")[currLineOffsetFromTop]);
    return vscode.window.createTextEditorDecorationType({
      before: {
        contentIconPath: uri,
        border: `transparent; position: absolute; z-index: 2147483647;
               box-shadow: inset 0 0 0 ${SVG_CONFIG.strokeWidth}px ${SVG_CONFIG.stroke}, inset 0 0 0 ${tipHeight}px;
               filter: ${SVG_CONFIG.filter};
               border-radius: ${SVG_CONFIG.radius}px;
               margin-top: ${-1 * offsetFromTop}px;
               margin-left: ${marginLeft}px;`,
        width: `${tipWidth}px`,
        height: `${tipHeight}px`,
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
  }

  private buildHideTooltipHoverMsg() {
    const hoverMarkdown = new vscode.MarkdownString(
      `[Reject (Esc)](command:${HIDE_NEXT_EDIT_SUGGESTION_COMMAND}) | [Accept (Tab)](command:${ACCEPT_NEXT_EDIT_SUGGESTION_COMMAND})`,
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

    // Check if line numbers are valid.
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

    // Check if character positions are valid.
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
   * Calculate a position to the right of the cursor with the specified offset.
   */
  private getDecorationOffsetPosition(
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
   * Render a tooltip with the given text at the specified position.
   */
  private async renderTooltip(
    editor: vscode.TextEditor,
    position: vscode.Position,
    originalCode: string,
    predictedCode: string,
    editableRegionStartLine: number,
  ) {
    console.log("renderTooltip");
    // Capture document version to detect changes.
    const docVersion = editor.document.version;

    // Create a new decoration with the text.
    const decoration = await this.createCodeRenderDecoration(
      originalCode,
      predictedCode,
      position,
      editableRegionStartLine,
    );
    if (!decoration) {
      console.error("Failed to create decoration for text:", predictedCode);
      return;
    }

    // Check if document changed during async operation.
    if (editor.document.version !== docVersion) {
      console.log("Document changed during decoration creation, aborting");
      decoration.dispose();
      return;
    }

    // Store the decoration and editor.
    await this.hideAllNextEditWindows();
    this.currentDecoration = decoration;
    this.activeEditor = editor;

    // Calculate how far off to the right of the cursor the decoration should be.
    const decorationOffsetPosition = this.getDecorationOffsetPosition(
      editor,
      position,
    );
    const range = new vscode.Range(
      decorationOffsetPosition,
      decorationOffsetPosition,
    );

    // Validate the range before applying.
    if (!this.isValidRange(editor, range)) {
      console.error("Invalid range detected, skipping decoration");
      return;
    }

    // Apply the decoration at the calculated position.
    editor.setDecorations(this.currentDecoration, [
      {
        range: new vscode.Range(
          decorationOffsetPosition,
          decorationOffsetPosition,
        ),
        hoverMessage: [this.buildHideTooltipHoverMsg()],
      },
    ]);

    // Clear the timeout while SVG is on the editor.
    if (this.currentDecoration && this.mostRecentCompletionId)
      this.loggingService.cancelRejectionTimeoutButKeepCompletionId(
        this.mostRecentCompletionId,
      );
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
