import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { NextEditOutcome } from "core/nextEdit/types";
// @ts-ignore
import svgBuilder from "svg-builder";
import * as vscode from "vscode";
import { getTheme } from "../util/getTheme";
import {
  HandlerPriority,
  SelectionChangeManager,
} from "./SelectionChangeManager";

// Instead of getters that execute immediately, use methods or lazy properties
const SVG_CONFIG = {
  stroke: "#999998",
  strokeWidth: 1,
  shortcutColor: "#999998",
  filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.2))",
  radius: 3,
  leftMargin: 40,
  debounceDelay: 500,
  label: "📍 Press Tab to jump, Esc to cancel",

  // Convert getters to methods that are called when needed
  getFontSize(): number {
    return Math.ceil(
      (vscode.workspace.getConfiguration("editor").get<number>("fontSize") ??
        14) * 0.8,
    );
  },

  getFontFamily(): string {
    return (
      vscode.workspace.getConfiguration("editor").get<string>("fontFamily") ||
      "helvetica"
    );
  },

  getPaddingX(): number {
    return Math.ceil(this.getEstimatedTextWidth(" "));
  },

  getGap(): number {
    return this.getFontSize() * 0.5;
  },

  getTipWidth(): number {
    return this.getEstimatedTextWidth(this.label) + this.getPaddingX();
  },

  getTipHeight(): number {
    return this.getFontSize();
  },

  getTextY(): number {
    return (this.getTipHeight() + this.getFontSize()) / 2;
  },

  getEstimatedTextWidth(text: string): number {
    return text.length * this.getFontSize() * 0.6;
  },
} as const;

export interface CompletionDataForAfterJump {
  completionId: string;
  outcome: NextEditOutcome;
  currentPosition: vscode.Position;
}

/**
 * This is how we handle jumps and manage decoration object lifetime.
 * There are mainly three states the user can be in: not jumping, jumping in progress, and just jumped.
 * This can potentially be an enum for better readability, but there is logic here that relies on
 * the _jumpAccepted flag to determine whether we should delete chains.
 */
export class JumpManager {
  private static _instance: JumpManager | undefined;

  // Decoration state.
  private _jumpIcon: vscode.Uri | undefined;
  private _jumpDecoration: vscode.TextEditorDecorationType | undefined;
  private _jumpDecorationVisible = false;
  private _disposables: vscode.Disposable[] = [];
  private _theme = getTheme();

  private _jumpInProgress: boolean = false;
  private _jumpAccepted: boolean = false;
  private _completionAfterJump: CompletionDataForAfterJump | null = null;
  private _oldCursorPosition: vscode.Position | undefined;

  private constructor() {
    // Build the first SVG icon
    this._createSvgJumpIcon();

    // Re‑build when the colour theme changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("workbench.colorTheme")) {
        this._theme = getTheme();
        this._createSvgJumpIcon();
      }
    });
  }

  initialize() {}

  public static getInstance(): JumpManager {
    if (!JumpManager._instance) {
      JumpManager._instance = new JumpManager();
    }
    return JumpManager._instance;
  }

  public static clearInstance() {
    if (JumpManager._instance) {
      JumpManager._instance.dispose();
      JumpManager._instance = undefined;
    }
  }

  public dispose() {
    // Dispose current decoration.
    this._disposables.forEach((d) => {
      if (d) d.dispose();
    });
    this._disposables = [];
  }

  private _createSvgJumpIcon() {
    const baseTextConfig = {
      y: SVG_CONFIG.getTextY(),
      "font-family": SVG_CONFIG.getFontFamily(),
      "font-size": SVG_CONFIG.getFontSize(),
    };

    try {
      // NOTE: it's critical to use svgBuilder.newInstance.
      // svgBuilder holds state of previously created SVGs,
      // so you end up with SVGs stacking on top of each other and being interleaved.
      const builder = svgBuilder.newInstance
        ? svgBuilder.newInstance()
        : svgBuilder;
      const svgContent = builder
        .width(SVG_CONFIG.getTipWidth())
        .height(SVG_CONFIG.getTipHeight())
        .text(
          {
            ...baseTextConfig,
            x: 4,
            fill: this._theme?.colors["editor.foreground"] ?? SVG_CONFIG.stroke,
          },
          SVG_CONFIG.label,
        )
        .render();

      const dataUri = `data:image/svg+xml;base64,${Buffer.from(
        svgContent,
      ).toString("base64")}`;
      this._jumpIcon = vscode.Uri.parse(dataUri);

      // Dispose the old decoration (if any) and create a fresh one.
      if (this._jumpDecoration) {
        this._jumpDecoration.dispose();
      }
      this._jumpDecoration = this._createSvgJumpDecoration();
    } catch (err) {
      console.error("Error creating SVG jump tooltip:", err);
    }
  }

  private _createSvgJumpDecoration(): vscode.TextEditorDecorationType {
    const backgroundColour =
      this._theme?.colors["editor.background"] ?? "#333333";

    return vscode.window.createTextEditorDecorationType({
      after: {
        contentIconPath: this._jumpIcon,
        border: `;box-shadow: inset 0 0 0 ${SVG_CONFIG.strokeWidth}px ${SVG_CONFIG.stroke}, inset 0 0 0 ${SVG_CONFIG.getTipHeight()}px ${backgroundColour};
                  border-radius: ${SVG_CONFIG.radius}px;
                  filter: ${SVG_CONFIG.filter}`,
        margin: `0 0 0 ${SVG_CONFIG.leftMargin}px`,
        width: `${SVG_CONFIG.getTipWidth()}px`,
      },
    });
  }

  public async suggestJump(
    currentPosition: vscode.Position,
    nextJumpLocation: vscode.Position,
    completionContent?: string,
  ): Promise<boolean> {
    // Deduplication logic.
    // If the content at the next jump location is
    // identical to the completion content,
    // then we don't have to jump.
    if (completionContent !== undefined) {
      console.debug("completionContent is not null");
      const editor = vscode.window.activeTextEditor;

      if (editor) {
        try {
          const completionLines = completionContent.split("\n");
          console.debug("completionLines:", completionLines);

          // Get document content at jump location spanning multiple lines.
          const document = editor.document;
          const startLine = nextJumpLocation.line;
          const endLine = Math.min(
            startLine + completionLines.length - 1,
            document.lineCount - 1,
          );

          // First check if we have enough lines in the document
          if (endLine - startLine + 1 < completionLines.length) {
            // Not enough lines in document, so content can't be identical.
            // Proceed to jump!
            console.debug(
              "Not enough lines in document to match completion content",
            );
          } else {
            let contentMatches = true;

            // Check all lines for match.
            for (let i = 0; i < completionLines.length && contentMatches; i++) {
              const documentLine = startLine + i;
              const lineText = document.lineAt(documentLine).text;
              if (lineText !== completionLines[i]) {
                contentMatches = false;
                console.debug(`Line ${i + 1} doesn't match`);
              }
            }

            if (contentMatches) {
              console.debug(
                "Skipping jump as content is identical at jump location",
              );
              return false; // Exit early, don't suggest jump.
            }
          }
        } catch (error) {
          console.error("Error checking content at jump location:", error);
          // Continue with jump even if there's an error checking content.
        }
      }
    }

    console.debug("this._jumpInProgress");
    this._jumpInProgress = true;
    this._oldCursorPosition = currentPosition;

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.debug("No active editor, cannot suggest jump");
      this._jumpInProgress = false;
      return false;
    }

    const visibleRanges = editor.visibleRanges;
    if (visibleRanges.length === 0) {
      console.debug("No visible ranges in editor, cannot suggest jump");
      this._jumpInProgress = false;
      return false;
    }

    const visibleRange = visibleRanges[0];
    const topLineNumber = visibleRange.start.line;
    const bottomLineNumber = visibleRange.end.line;

    const decorationLine = nextJumpLocation.line;

    // Check if jump location is outside the visible range.
    if (decorationLine < topLineNumber) {
      await this.renderTabToJumpDecoration(
        editor,
        topLineNumber,
        nextJumpLocation,
      );
    } else if (decorationLine > bottomLineNumber) {
      await this.renderTabToJumpDecoration(
        editor,
        bottomLineNumber,
        nextJumpLocation,
      );
    } else {
      // No suggestion is made when the decoration is within visibleRange.
      await this.renderTabToJumpDecoration(
        editor,
        decorationLine,
        nextJumpLocation,
      );
    }

    return true;
  }

  private async renderTabToJumpDecoration(
    editor: vscode.TextEditor,
    lineToRenderOn: number,
    jumpPosition: vscode.Position,
  ) {
    // Clean up any existing decoration beforehand.
    await this.clearJumpDecoration();

    // Create a decoration for jump.
    if (!this._jumpDecoration) {
      this._createSvgJumpIcon(); // makes both the icon & decoration
    }

    // Apply the decoration.
    const lastIndexOfLine = editor.document.lineAt(lineToRenderOn).text.length;
    editor.setDecorations(this._jumpDecoration!, [
      new vscode.Range(
        lineToRenderOn,
        lastIndexOfLine,
        lineToRenderOn,
        lastIndexOfLine,
      ),
    ]);

    // Set the context key to enable tab/esc shortcuts.
    await vscode.commands.executeCommand(
      "setContext",
      "continue.jumpDecorationVisible",
      true,
    );
    this._jumpDecorationVisible = true;

    // Register the key listeners.
    await this.registerKeyListeners(editor, jumpPosition);
  }

  private async clearJumpDecoration() {
    if (this._jumpDecoration) {
      this._jumpDecoration.dispose();
      this._jumpDecoration = undefined;
    }

    // Dispose any active listeners.
    this.dispose();

    // Reset the context.
    await vscode.commands.executeCommand(
      "setContext",
      "continue.jumpDecorationVisible",
      false,
    );
    this._jumpDecorationVisible = false;
  }

  private async registerKeyListeners(
    editor: vscode.TextEditor,
    jumpPosition: vscode.Position,
  ) {
    const acceptJumpCommand = vscode.commands.registerCommand(
      "continue.acceptJump",
      async () => {
        if (this._jumpDecorationVisible) {
          this._jumpAccepted = true;

          // Scroll to show the jump location.
          editor.revealRange(
            new vscode.Range(jumpPosition.line, 0, jumpPosition.line, 0),
            vscode.TextEditorRevealType.InCenter,
          );

          // Move cursor to the jump position.
          editor.selection = new vscode.Selection(jumpPosition, jumpPosition);
          await this.clearJumpDecoration();

          this._jumpAccepted = false;
          vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
        }
      },
    );

    const rejectJumpCommand = vscode.commands.registerCommand(
      "continue.rejectJump",
      async () => {
        if (this._jumpDecorationVisible) {
          console.debug(
            "deleteChain from JumpManager.ts: rejectJump and decoration visible",
          );
          NextEditProvider.getInstance().deleteChain();
          await this.clearJumpDecoration();
        }
      },
    );

    // Add a selection change listener to the editor to reject jump when cursor moves.
    const selectionChangeListener =
      vscode.window.onDidChangeTextEditorSelection((e) => {
        // If jump decoration isn't visible, nothing to do.
        if (!this._jumpDecorationVisible) {
          return;
        }

        const currentPosition = e.selections[0].active;

        // If cursor moved to jump position, this is likely the result of acceptJump.
        if (currentPosition.isEqual(jumpPosition)) {
          return;
        }

        // If cursor position changed for any other reason, reject the jump.
        if (
          this._oldCursorPosition &&
          !currentPosition.isEqual(this._oldCursorPosition)
        ) {
          vscode.commands.executeCommand("continue.rejectJump");
        }
      });

    // This allows us to dispose the command after a jump is completed.
    this._disposables.push(
      acceptJumpCommand,
      rejectJumpCommand,
      selectionChangeListener,
    );
  }

  isJumpInProgress(): boolean {
    return this._jumpInProgress;
  }

  setJumpInProgress(jumpInProgress: boolean) {
    this._jumpInProgress = jumpInProgress;
  }

  wasJumpJustAccepted(): boolean {
    return this._jumpAccepted;
  }

  setCompletionAfterJump(completionData: CompletionDataForAfterJump): void {
    this._completionAfterJump = completionData;
  }

  clearCompletionAfterJump(): void {
    this._completionAfterJump = null;
  }

  get completionAfterJump() {
    return this._completionAfterJump;
  }

  public registerSelectionChangeHandler(): void {
    const manager = SelectionChangeManager.getInstance();

    manager.registerListener(
      "jumpManager",
      async (e, state) => {
        if (state.jumpInProgress || state.jumpJustAccepted) {
          console.debug(
            "JumpManager: jump in progress or just accepted, preserving chain",
          );
          return true;
        }

        return false;
      },
      HandlerPriority.HIGH,
    );
  }
}
