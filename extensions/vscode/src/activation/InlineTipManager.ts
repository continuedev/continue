/* eslint-disable @typescript-eslint/naming-convention */
import { EXTENSION_NAME } from "core/control-plane/env";
// @ts-ignore
import svgBuilder from "svg-builder";
import * as vscode from "vscode";

import { getTheme } from "../util/getTheme";
import { getMetaKeyLabel, getMetaKeyName } from "../util/util";

const SVG_CONFIG = {
  stroke: "#999998",
  strokeWidth: 1,
  shortcutColor: "#999998",
  filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.2))",
  radius: 3,
  leftMargin: 40,
  debounceDelay: 500,
  chatLabel: "Chat",
  chatShortcut: `${getMetaKeyLabel()}+L`,
  editLabel: "Edit",
  editShortcut: `${getMetaKeyLabel()}+I`,

  get fontSize() {
    return Math.ceil(
      (vscode.workspace.getConfiguration("editor").get<number>("fontSize") ??
        14) * 0.8,
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
  get gap() {
    return this.fontSize * 0.5;
  },
  get tipWidth() {
    return (
      this.editShortcutX +
      this.getEstimatedTextWidth(this.editShortcut) +
      this.paddingX
    );
  },
  get tipHeight() {
    return this.fontSize;
  },
  get textY() {
    return (this.tipHeight + this.fontSize)/2;
  },
  get chatLabelX() {
    return this.paddingX;
  },
  get chatShortcutX() {
    return this.chatLabelX + this.getEstimatedTextWidth(this.chatLabel + " ");
  },
  get editLabelX() {
    return this.chatShortcutX + this.getEstimatedTextWidth(this.chatShortcut) + this.gap;
  },
  get editShortcutX() {
    return this.editLabelX + this.getEstimatedTextWidth(this.editLabel + " ");
  },
  getEstimatedTextWidth(text: string): number {
    return text.length * this.fontSize * 0.6;
  },
} as const;

export class InlineTipManager {
  private static instance: InlineTipManager;

  private readonly excludedURIPrefixes = ["output:", "vscode://inline-chat"];
  private readonly hideCommand = "continue.hideInlineTip";
  private svgTooltip: vscode.Uri | undefined = undefined;

  private debounceTimer: NodeJS.Timeout | undefined;
  private lastActiveEditor?: vscode.TextEditor;
  private theme = getTheme();
  private svgTooltipDecoration = this.createSvgTooltipDecoration();
  private emptyFileTooltipDecoration = this.createEmptyFileTooltipDecoration();

  public static getInstance(): InlineTipManager {
    if (!InlineTipManager.instance) {
      InlineTipManager.instance = new InlineTipManager();
    }
    return InlineTipManager.instance;
  }

  private constructor() {
    this.createSvgTooltip();
    this.setupSvgTipListeners();
  }

  public setupInlineTips(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        this.handleSelectionChange(e);
      }),
    );

    this.setupEmptyFileTips(context);

    context.subscriptions.push(this);
  }

  public handleSelectionChange(e: vscode.TextEditorSelectionChangeEvent) {
    const selection = e.selections[0];
    const editor = e.textEditor;

    if (selection.isEmpty || !this.shouldRenderTip(editor.document.uri)) {
      editor.setDecorations(this.svgTooltipDecoration, []);
      return;
    }

    this.debouncedSelectionChange(editor, selection);
  }

  public dispose() {
    this.svgTooltipDecoration.dispose();
    this.emptyFileTooltipDecoration.dispose();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  private debouncedSelectionChange(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
  ) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      // Clear decoration from previous editor
      if (this.lastActiveEditor && this.lastActiveEditor !== editor) {
        this.lastActiveEditor.setDecorations(this.svgTooltipDecoration, []);
      }

      this.lastActiveEditor = editor;

      this.updateTooltipPosition(editor, selection);
    }, SVG_CONFIG.debounceDelay);
  }

  private setupSvgTipListeners() {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("workbench.colorTheme")) {
        this.theme = getTheme();
        this.createSvgTooltip();
      }
    });

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.fontSize")) {
        this.createSvgTooltip();
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

  private setupEmptyFileTips(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (
          editor?.document.getText() === "" &&
          this.shouldRenderTip(editor.document.uri)
        ) {
          editor.setDecorations(this.emptyFileTooltipDecoration, [
            {
              range: new vscode.Range(
                new vscode.Position(0, Number.MAX_VALUE),
                new vscode.Position(0, Number.MAX_VALUE),
              ),
            },
          ]);
        }
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (
          e.document.getText() === "" &&
          this.shouldRenderTip(e.document.uri)
        ) {
          vscode.window.visibleTextEditors.forEach((editor) => {
            editor.setDecorations(this.emptyFileTooltipDecoration, [
              {
                range: new vscode.Range(
                  new vscode.Position(0, Number.MAX_VALUE),
                  new vscode.Position(0, Number.MAX_VALUE),
                ),
              },
            ]);
          });
        } else {
          vscode.window.visibleTextEditors.forEach((editor) => {
            editor.setDecorations(this.emptyFileTooltipDecoration, []);
          });
        }
      }),
    );
  }

  private createEmptyFileTooltipDecoration() {
    return vscode.window.createTextEditorDecorationType({
      after: {
        contentText: `Use ${getMetaKeyName()} + I to generate code`,
        color: "#888",
        margin: "2em 0 0 0",
        fontStyle: "italic",
      },
    });
  }

  private createSvgTooltipDecoration() {
    var backgroundColour = 0;
    if (this.theme) {
      backgroundColour = this.theme.colors["editor.background"];
    }
    return vscode.window.createTextEditorDecorationType({
      after: {
        contentIconPath: this.svgTooltip,
        border: `;box-shadow: inset 0 0 0 ${SVG_CONFIG.strokeWidth}px ${SVG_CONFIG.stroke}, inset 0 0 0 ${SVG_CONFIG.tipHeight}px ${backgroundColour};
                  border-radius: ${SVG_CONFIG.radius}px;
                  filter: ${SVG_CONFIG.filter}`,
        margin: `0 0 0 ${SVG_CONFIG.leftMargin}px`,
        width: `${SVG_CONFIG.tipWidth}px`,
      },
    });
  }

  private createSvgTooltip() {
    const baseTextConfig = {
      y: SVG_CONFIG.textY,
      "font-family": SVG_CONFIG.fontFamily,
      "font-size": SVG_CONFIG.fontSize,
    };

    if (!this.theme) {
      return;
    }

    try {
      const svgContent = svgBuilder
        .width(SVG_CONFIG.tipWidth)
        .height(SVG_CONFIG.tipHeight)
        // Chat
        .text(
          {
            ...baseTextConfig,
            x: SVG_CONFIG.chatLabelX,
            fill: this.theme.colors["editor.foreground"],
          },
          SVG_CONFIG.chatLabel,
        )
        .text(
          {
            ...baseTextConfig,
            x: SVG_CONFIG.chatShortcutX,
            fill: SVG_CONFIG.shortcutColor,
          },
          SVG_CONFIG.chatShortcut,
        )
        // Edit
        .text(
          {
            ...baseTextConfig,
            x: SVG_CONFIG.editLabelX,
            fill: this.theme.colors["editor.foreground"],
          },
          SVG_CONFIG.editLabel,
        )
        .text(
          {
            ...baseTextConfig,
            x: SVG_CONFIG.editShortcutX,
            fill: SVG_CONFIG.shortcutColor,
          },
          SVG_CONFIG.editShortcut,
        )
        .render();

      const dataUri = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString("base64")}`;

      this.svgTooltip = vscode.Uri.parse(dataUri);
      this.svgTooltipDecoration.dispose();
      this.svgTooltipDecoration = this.createSvgTooltipDecoration();
    } catch (error) {
      console.error("Error creating SVG for inline tip:", error);
    }
  }

  private buildHideTooltipHoverMsg() {
    const hoverMarkdown = new vscode.MarkdownString(
      `[Disable](command:${this.hideCommand})`,
    );

    hoverMarkdown.isTrusted = true;
    hoverMarkdown.supportHtml = true;
    return hoverMarkdown;
  }

  /**
   * Calculates tooltip position using these rules:
   * 1. For single-line selection: Place after the line's content
   * 2. For multi-line selection: Place after the longer line between:
   *    - The first non-empty selected line
   *    - The line above the selection
   * Returns null if selection is empty or contains only empty lines
   */
  private calculateTooltipPosition(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
  ): vscode.Position | null {
    const document = editor.document;

    // Get selection info
    const startLine = selection.start.line;
    const endLine = selection.end.line;
    const isFullLineSelection =
      selection.start.character === 0 &&
      (selection.end.line > selection.start.line
        ? selection.end.character === 0
        : selection.end.character ===
          document.lineAt(selection.end.line).text.length);

    // Helper functions
    const isLineEmpty = (lineNumber: number): boolean => {
      return document.lineAt(lineNumber).text.trim().length === 0;
    };

    const getLineEndChar = (lineNumber: number): number => {
      return document.lineAt(lineNumber).text.trimEnd().length;
    };

    // If single empty line selected and not full line selection, return null
    if (
      startLine === endLine &&
      isLineEmpty(startLine) &&
      !isFullLineSelection
    ) {
      return null;
    }

    // Find topmost non-empty line
    let topNonEmptyLine = startLine;
    while (topNonEmptyLine <= endLine && isLineEmpty(topNonEmptyLine)) {
      topNonEmptyLine++;
    }

    // If all lines empty, return null
    if (topNonEmptyLine > endLine) {
      return null;
    }

    const OFFSET = 4; // Characters to offset from end of line

    // Single line or full line selection
    if (isFullLineSelection || startLine === endLine) {
      return new vscode.Position(
        topNonEmptyLine,
        getLineEndChar(topNonEmptyLine) + OFFSET,
      );
    }

    // Check line above selection
    const lineAboveSelection = Math.max(0, startLine - 1);

    // Get end positions
    const topNonEmptyEndChar = getLineEndChar(topNonEmptyLine);
    const lineAboveEndChar = getLineEndChar(lineAboveSelection);

    const baseEndChar = Math.max(topNonEmptyEndChar, lineAboveEndChar);

    return new vscode.Position(topNonEmptyLine, baseEndChar + OFFSET);
  }

  private updateTooltipPosition(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
  ) {
    const position = this.calculateTooltipPosition(editor, selection);

    if (!position) {
      editor.setDecorations(this.svgTooltipDecoration, []);
      return;
    }

    editor.setDecorations(this.svgTooltipDecoration, [
      {
        range: new vscode.Range(position, position),
        hoverMessage: [this.buildHideTooltipHoverMsg()],
      },
    ]);
  }
}

export default function setupInlineTips(context: vscode.ExtensionContext) {
  InlineTipManager.getInstance().setupInlineTips(context);
}
