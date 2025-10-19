/* eslint-disable @typescript-eslint/naming-convention */
import { EXTENSION_NAME } from "core/control-plane/env";
// @ts-ignore
import * as vscode from "vscode";

import { DiffChar, DiffLine } from "core";
import { CodeRenderer } from "core/codeRenderer/CodeRenderer";
import { myersCharDiff } from "core/diff/myers";
import { getOffsetPositionAtLastNewLine } from "core/nextEdit/diff/diff";
import { NextEditLoggingService } from "core/nextEdit/NextEditLoggingService";
import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { getThemeString } from "../util/getTheme";
import {
  HandlerPriority,
  SelectionChangeManager,
} from "./SelectionChangeManager";

export interface TextApplier {
  applyText(
    editor: vscode.TextEditor,
    text: string,
    position: vscode.Position,
    finalCursorPos: vscode.Position | null,
  ): Promise<boolean>;
}

const SVG_CONFIG = {
  // stroke: "#999998",
  stroke: "#666667",
  strokeWidth: 1,
  textColor: "#999998",
  purple: "rgba(112, 114, 209)",
  blue: "rgba(107, 166, 205)",
  green: "rgba(136 194 163)",
  // filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.2))",
  // filter: "drop-shadow(0 2px 2px rgba(255,255,255,0.2))",
  // filter:
  //   "drop-shadow(0 2px 4px rgb(112, 114, 209)) drop-shadow(0 4px 8px rgb(136, 194, 163)) drop-shadow(0 6px 12px rgb(107, 166, 205));",
  // filter:
  //   "drop-shadow(0 3px 6px rgba(112, 114, 209, 0.4)) drop-shadow(0 3px 6px rgba(136, 194, 163, 0.4)) drop-shadow(0 3px 6px rgba(107, 166, 205, 0.4));",
  // filter: `drop-shadow(4px 4px 0px rgba(112, 114, 209, 0.4))
  //       drop-shadow(8px 8px 0px rgba(107, 166, 205, 0.3))
  //       drop-shadow(12px 12px 0px rgba(136, 194, 163, 0.2));`,
  // filter: `drop-shadow(4px 4px 0px rgba(112, 114, 209, 0.4))
  //       drop-shadow(-2px 4px 0px rgba(107, 166, 205, 0.3))
  //       drop-shadow(4px -2px 0px rgba(136, 194, 163, 0.2))
  //       drop-shadow(-2px -2px 0px rgba(112, 114, 209, 0.2));`,
  filter: "none",
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

/**
 * This is where we create SVG windows and deletion decorations for non-FIM next edit suggestions.
 * This class controls the decoration object lifetime.
 * The syntax highlighting and the actual building of SVG happens inside core/codeRenderer/CodeRenderer.ts.
 */
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
  // Helps us skip redundant calculations. No need for cleanup because this always gets reassigned with new values at showNextEditWindow, and we don't reuse windows.
  private editableRegionStartLine: number = 0;
  private editableRegionEndLine: number = 0;

  // State tracking for key reservation.
  // By default it is set to free, and is only set to reserved when the transition is done.
  private keyReservationState: "free" | "reserved" | "transitioning" = "free";
  private latestOperationId = 0;

  // Disposables
  private disposables: vscode.Disposable[] = [];

  private textApplier: TextApplier | null = null;

  private finalCursorPos: vscode.Position | null = null;

  private isLineDelete: boolean = false;

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

    console.debug(
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

  // This is an implementation of last-action-wins.
  // For each action that fires setKeyReservation, it keeps its own operationId while incrementing latestOperationId.
  // When an action completes, checking for operationId === latestOperationId will determine which one came last.
  private async setKeyReservation(reserve: boolean): Promise<void> {
    // Increment and capture this operation's ID.
    const operationId = ++this.latestOperationId;

    // Return early when already in desired state.
    if (
      (reserve && this.keyReservationState === "reserved") ||
      (!reserve && this.keyReservationState === "free")
    ) {
      return;
    }

    try {
      await this.performKeyReservation(reserve);

      // Only update state if we're still the latest operation.
      if (operationId === this.latestOperationId) {
        this.keyReservationState = reserve ? "reserved" : "free";
      }
    } catch (err) {
      console.error(`Failed to set nextEditWindowActive to ${reserve}: ${err}`);

      // Only reset to free if we're still the latest operation.
      if (operationId === this.latestOperationId) {
        this.keyReservationState = "free";
      }
      throw err;
    }
  }

  public async resetKeyReservation(): Promise<void> {
    // Reset internal tracking.
    this.keyReservationState = "free";
    this.latestOperationId = 0;

    // Ensure VS Code context matches.
    try {
      await this.performKeyReservation(false);
    } catch (err) {
      console.error(`Failed to reset nextEditWindowActive context: ${err}`);
    }
  }

  private async performKeyReservation(reserve: boolean): Promise<void> {
    try {
      await vscode.commands.executeCommand(
        "setContext",
        "nextEditWindowActive",
        reserve,
      );
    } catch (err) {
      console.error(`Failed to set nextEditWindowActive to ${reserve}: ${err}`);
      throw err;
    }
  }

  public static async reserveTabAndEsc() {
    await NextEditWindowManager.getInstance().setKeyReservation(true);
  }

  public static async freeTabAndEsc() {
    await NextEditWindowManager.getInstance().setKeyReservation(false);
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
    await this.resetKeyReservation();
    // await NextEditWindowManager.freeTabAndEsc();

    // Register HIDE_TOOLTIP_COMMAND and ACCEPT_NEXT_EDIT_COMMAND with their corresponding callbacks.
    this.registerCommandSafely(HIDE_NEXT_EDIT_SUGGESTION_COMMAND, async () => {
      console.debug(
        "deleteChain from NextEditWindowManager.ts: hide next edit command",
      );
      NextEditProvider.getInstance().deleteChain();
      await this.hideAllNextEditWindowsAndResetCompletionId();
    });
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
    editableRegionEndLine: number,
    oldEditRangeSlice: string,
    newEditRangeSlice: string,
    diffLines: DiffLine[],
  ) {
    if (!this.shouldRenderTip(editor.document.uri)) {
      return;
    }

    // Clear any existing decorations first (very important to prevent overlapping).
    await this.hideAllNextEditWindows();

    this.activeEditor = editor;

    this.editableRegionStartLine = editableRegionStartLine;
    this.editableRegionEndLine = editableRegionEndLine;

    // Store the current tooltip text for accepting later.
    this.currentTooltipText = newEditRangeSlice;

    // Determine if this is a line deletion case
    // NOTE: A simpler approach might be to just delete the line when newEditRangeSlice is "".
    // But we opt for the below in case the above note is too naive.
    this.isLineDelete = false;
    if (
      newEditRangeSlice === "" &&
      editableRegionStartLine === editableRegionEndLine
    ) {
      // Check if diffLines contains only deletions (no additions).
      const onlyDeletions = diffLines.every(
        (diff) => diff.type === "old" || diff.type === "same",
      );
      const hasDeletedLine = diffLines.some((diff) => diff.type === "old");

      if (onlyDeletions && hasDeletedLine) {
        // Check if the entire line is being deleted (not just characters).
        const line = editor.document.lineAt(editableRegionStartLine).text;
        const oldLine = oldEditRangeSlice.trim();
        if (line.trim() === oldLine || line.trim() === "") {
          this.isLineDelete = true;
        }
      }
    }

    // How far away is the current line from the start of the editable region?
    const lineOffsetAtCursorPos =
      currCursorPos.line - this.editableRegionStartLine;

    // How long is the line at the current cursor position?
    const lineContentAtCursorPos =
      newEditRangeSlice.split("\n")[lineOffsetAtCursorPos];

    const offset = getOffsetPositionAtLastNewLine(
      diffLines,
      lineContentAtCursorPos,
      lineOffsetAtCursorPos,
    );

    // Calculate the final cursor position.
    if (this.isLineDelete) {
      // For line deletion, position cursor at the end of the previous line.
      if (this.editableRegionStartLine > 0) {
        const prevLine = editor.document.lineAt(
          this.editableRegionStartLine - 1,
        );
        this.finalCursorPos = new vscode.Position(
          this.editableRegionStartLine - 1,
          prevLine.text.length,
        );
      } else {
        // If we're deleting the first line, position at the start of the document.
        this.finalCursorPos = new vscode.Position(0, 0);
      }
    } else {
      // For normal edits, use the standard calculation.
      this.finalCursorPos = new vscode.Position(
        this.editableRegionStartLine + offset.line,
        offset.character,
      );
    }

    const diffChars = myersCharDiff(oldEditRangeSlice, newEditRangeSlice);

    // Create and apply decoration with the text.
    if (newEditRangeSlice !== "") {
      try {
        await this.renderWindow(
          editor,
          currCursorPos,
          oldEditRangeSlice,
          newEditRangeSlice,
          this.editableRegionStartLine,
          diffLines,
          diffChars,
        );
      } catch (error) {
        console.error("Failed to render window:", error);
        // Clean up and reset state.
        await this.hideAllNextEditWindows();
        return;
      }
    }

    this.renderDeletions(editor, diffChars);

    // Reserve tab and esc to either accept or reject the displayed next edit contents.
    try {
      await NextEditWindowManager.reserveTabAndEsc();
    } catch (err) {
      console.error(
        `Error reserving Tab/Esc after showing decorations: ${err}`,
      );
      await this.hideAllNextEditWindows();
      return;
    }
  }

  /**
   * Hide all tooltips in all editors.
   */
  public async hideAllNextEditWindows() {
    try {
      await NextEditWindowManager.freeTabAndEsc();
    } catch (err) {
      console.error(`Error freeing Tab/Esc while hiding: ${err}`);
    }

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

      // Clear the current tooltip text.
      this.currentTooltipText = null;
    }

    if (this.disposables.length > 0) {
      this.disposables.forEach((d) => d.dispose());
      this.disposables = [];
    }
  }

  public async hideAllNextEditWindowsAndResetCompletionId() {
    await this.hideAllNextEditWindows();

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
    if (this.activeEditor === null || this.currentTooltipText === null) {
      return;
    }
    this.accepted = true;

    const editor = this.activeEditor;
    const text = this.currentTooltipText;
    const position = editor.selection.active;

    let success = false;

    // Hide windows first for a snappier feel.
    await this.hideAllNextEditWindows();

    if (this.textApplier) {
      success = await this.textApplier.applyText(
        editor,
        text,
        position,
        this.finalCursorPos,
      );
    } else {
      // Define the range to replace.
      const startPos = new vscode.Position(this.editableRegionStartLine, 0);
      const endPosChar = editor.document.lineAt(this.editableRegionEndLine).text
        .length;

      const endPos = new vscode.Position(
        this.editableRegionEndLine,
        endPosChar,
      );
      const editRange = new vscode.Range(startPos, endPos);

      if (this.isLineDelete) {
        // Handle line deletion - extend the range to include the newline.
        let lineDeleteRange = editRange;

        // If this isn't the last line, extend to include the newline character.
        if (this.editableRegionStartLine < editor.document.lineCount - 1) {
          lineDeleteRange = new vscode.Range(
            startPos,
            new vscode.Position(this.editableRegionStartLine + 1, 0),
          );
        }

        success = await editor.edit((editBuilder) => {
          editBuilder.delete(lineDeleteRange);
        });
      } else {
        success = await editor.edit((editBuilder) => {
          editBuilder.replace(editRange, text);
        });
      }
    }

    if (success && this.finalCursorPos) {
      // Move cursor to the final position if available.
      editor.selection = new vscode.Selection(
        this.finalCursorPos,
        this.finalCursorPos,
      );
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
    void this.resetKeyReservation().catch((err) =>
      console.error(`Failed to reset keys on dispose: ${err}`),
    );

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
    vscode.workspace.onDidChangeConfiguration(async (e) => {
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
        await this.codeRenderer.setTheme(this.theme);
        console.debug(
          "Theme updated:",
          this.theme ? "Theme exists" : "Theme is undefined",
        );
        const editorConfig = vscode.workspace.getConfiguration("editor");
        this.fontSize = editorConfig.get<number>("fontSize") ?? 14;
        this.fontFamily = editorConfig.get<string>("fontFamily") ?? "monospace";
      }
    });

    // Listen for active color theme changes.
    vscode.window.onDidChangeActiveColorTheme(async () => {
      this.theme = getThemeString();
      await this.codeRenderer.setTheme(this.theme);
      console.debug(
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
        if (this.mostRecentCompletionId) {
          this.loggingService.cancelRejectionTimeout(
            this.mostRecentCompletionId,
          );
        }
        await this.hideAllNextEditWindows();
      }
    });

    // Listen for selection changes to hide tooltip when cursor moves.
    vscode.window.onDidChangeTextEditorSelection(async (e) => {
      // If the selection changed in our active editor, hide the tooltip.
      if (this.activeEditor && e.textEditor === this.activeEditor) {
        // If the cursor moved because of something other than accepting next edit, stop logging it.
        if (!this.accepted && this.mostRecentCompletionId) {
          this.loggingService.cancelRejectionTimeout(
            this.mostRecentCompletionId,
          );
        }
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
    newDiffLines: DiffLine[],
    diffChars: DiffChar[],
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
        {
          imageType: "svg",
          fontSize: this.fontSize,
          fontFamily: this.fontFamily,
          dimensions: dimensions,
          lineHeight: SVG_CONFIG.lineHeight,
        },
        currLineOffsetFromTop,
        newDiffLines,
        diffChars,
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
    newDiffLines: DiffLine[],
    diffChars: DiffChar[],
  ): Promise<vscode.TextEditorDecorationType | undefined> {
    const currLineOffsetFromTop = position.line - editableRegionStartLine;
    const uriAndDimensions = await this.createCodeRender(
      predictedCode,
      currLineOffsetFromTop,
      newDiffLines,
      diffChars,
    );
    if (!uriAndDimensions) {
      return undefined;
    }

    const { uri, dimensions } = uriAndDimensions;
    const tipWidth = dimensions.width;
    const tipHeight = dimensions.height;

    const offsetFromTop =
      (position.line - editableRegionStartLine) * SVG_CONFIG.lineHeight;

    // Position the decoration with minimal left margin since it's already at line end
    const marginLeft = SVG_CONFIG.paddingX; // Use consistent padding instead of complex calculation

    return vscode.window.createTextEditorDecorationType({
      before: {
        contentIconPath: uri,
        border: `transparent; position: absolute; z-index: 2147483647;        
              filter: ${SVG_CONFIG.filter};
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
      console.debug(
        "Invalid start line:",
        range.start.line,
        "doc lines:",
        doc.lineCount,
      );
      return false;
    }

    if (range.end.line < 0 || range.end.line >= doc.lineCount) {
      console.debug(
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
      console.debug(
        "Invalid start character:",
        range.start.character,
        "line length:",
        startLine.text.length,
      );
      return false;
    }

    if (range.end.character < 0 || range.end.character > endLine.text.length) {
      console.debug(
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
    // Place decoration at the end of the current line
    const line = editor.document.lineAt(position.line);
    return new vscode.Position(position.line, line.text.length);
  }

  /**
   * Render a window with the given text at the specified position.
   */
  private async renderWindow(
    editor: vscode.TextEditor,
    position: vscode.Position,
    originalCode: string,
    predictedCode: string,
    editableRegionStartLine: number,
    newDiffLines: DiffLine[],
    diffChars: DiffChar[],
  ) {
    // Capture document version to detect changes.
    const docVersion = editor.document.version;

    // Create a new decoration with the text.
    const decoration = await this.createCodeRenderDecoration(
      originalCode,
      predictedCode,
      position,
      editableRegionStartLine,
      newDiffLines,
      diffChars,
    );
    if (!decoration) {
      console.error("Failed to create decoration for text:", predictedCode);
      return;
    }

    // Check if document changed during async operation.
    if (editor.document.version !== docVersion) {
      console.debug("Document changed during decoration creation, aborting");
      decoration.dispose();
      return;
    }

    // Store the decoration and editor.
    this.currentDecoration = decoration; // TODO: This might be redundant.
    this.disposables.push(decoration);

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

  private renderDeletions(editor: vscode.TextEditor, oldDiffChars: DiffChar[]) {
    const charsToDelete: vscode.DecorationOptions[] = [];

    // const diffChars = myersCharDiff(oldEditRangeSlice, newEditRangeSlice);

    oldDiffChars.forEach((diff) => {
      // TODO: This check if technically redundant.
      if (diff.type === "old") {
        charsToDelete.push({
          range: new vscode.Range(
            new vscode.Position(
              this.editableRegionStartLine + diff.oldLineIndex!,
              diff.oldCharIndexInLine!,
            ),
            new vscode.Position(
              this.editableRegionStartLine + diff.oldLineIndex!,
              diff.oldCharIndexInLine! + diff.char.length,
            ),
          ),
        });
      }
    });

    const deleteDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(255, 0, 0, 0.5)",
    });

    editor.setDecorations(deleteDecorationType, charsToDelete);
    this.disposables.push(deleteDecorationType);
  }

  async getExactCharacterWidth(): Promise<number> {
    // For VS Code extensions, you can sometimes access the editor's text metrics
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      // VS Code has internal methods to measure text, but they're not all exposed
      // in the public API. You might need to use reflection or known properties.

      // Example accessing through reflection (this is pseudocode)
      const editorInstance = activeEditor as any;
      if (editorInstance._modelData && editorInstance._modelData.viewModel) {
        const viewModel = editorInstance._modelData.viewModel;
        return (
          viewModel.getLineWidth(0) /
          activeEditor.document.lineAt(0).text.length
        );
      }
    }

    // If all else fails, return a reasonable default
    return SVG_CONFIG.fontSize * 0.6;
  }

  public hasAccepted() {
    return this.accepted;
  }

  public registerSelectionChangeHandler(): void {
    const manager = SelectionChangeManager.getInstance();

    manager.registerListener(
      "nextEditWindowManager",
      async (e, state) => {
        if (state.nextEditWindowAccepted) {
          console.debug(
            "NextEditWindowManager: Edit was just accepted, preserving chain",
          );
          return true;
        }
        return false;
      },
      HandlerPriority.CRITICAL,
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
